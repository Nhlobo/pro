// Setup wizard steps:
//  - action: "set-password"  (consume activation token OR use current session if legacy user) → sets password
//  - action: "send-setup-otp" → sends OTP to verified email
//  - action: "verify-setup-otp" → verifies OTP, marks security_setup_completed=true,
//                                 marks email_confirmed via admin update, clears must_reset_password
// All password changes go through server-side policy validation.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  adminClient, corsHeaders, json, sha256Hex, validatePasswordPolicy,
  generateNumericOtp, extractEventContext, recordAuthEvent, brandedEmail, userClient,
} from "../_shared/auth-helpers.ts";
import { sendEmail } from "../_shared/email.ts";

async function resolveUser(req: Request, payload: Record<string, unknown>): Promise<{ id: string; email: string } | null> {
  const admin = adminClient();
  // 1. Activation token wins.
  if (payload.activationToken && typeof payload.activationToken === "string") {
    const hash = await sha256Hex(payload.activationToken);
    const { data: row } = await admin.from("auth_activation_tokens")
      .select("user_id, expires_at, consumed_at").eq("token_hash", hash).maybeSingle();
    if (!row || row.consumed_at || new Date(row.expires_at) < new Date()) return null;
    const { data: profile } = await admin.from("profiles").select("email").eq("id", row.user_id).maybeSingle();
    if (!profile?.email) return null;
    return { id: row.user_id, email: profile.email };
  }
  // 2. Authenticated legacy user (already logged in, must complete setup).
  const u = userClient(req);
  const { data: userData } = await u.auth.getUser();
  if (userData.user) return { id: userData.user.id, email: userData.user.email ?? "" };
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const ctx = extractEventContext(req);
  const admin = adminClient();
  try {
    const payload = await req.json();
    const action = payload?.action;
    const user = await resolveUser(req, payload);
    if (!user) return json({ error: "Unauthorized" }, 401);

    if (action === "set-password") {
      const policyErr = validatePasswordPolicy(payload.password);
      if (policyErr) return json({ error: policyErr }, 400);
      const { error: updErr } = await admin.auth.admin.updateUserById(user.id, { password: payload.password });
      if (updErr) return json({ error: "Failed to set password" }, 500);
      await admin.from("profiles").update({ must_reset_password: false }).eq("id", user.id);
      await recordAuthEvent(admin, { user_id: user.id, email: user.email, event_type: "password_created", ctx });
      return json({ success: true });
    }

    if (action === "send-setup-otp") {
      await admin.from("auth_login_otps")
        .update({ superseded_at: new Date().toISOString() })
        .eq("user_id", user.id).eq("purpose", "setup")
        .is("consumed_at", null).is("superseded_at", null);
      const otp = generateNumericOtp(6);
      const otpHash = await sha256Hex(otp);
      await admin.from("auth_login_otps").insert({
        user_id: user.id, otp_hash: otpHash, purpose: "setup",
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
      await sendEmail({
        to: user.email,
        subject: `Your security setup code: ${otp}`,
        html: brandedEmail("Verify your email", `
          <p>Enter this code in the security setup wizard to verify your email. Expires in 5 minutes.</p>
          <p style="text-align:center; font-size:32px; letter-spacing:6px; font-weight:bold; color:#0f172a; margin:24px 0;">${otp}</p>
        `),
      });
      await recordAuthEvent(admin, { user_id: user.id, email: user.email, event_type: "otp_sent", ctx, metadata: { purpose: "setup" } });
      return json({ success: true });
    }

    if (action === "verify-setup-otp") {
      const submitted = String(payload.otp ?? "");
      const { data: otpRow } = await admin.from("auth_login_otps")
        .select("id, otp_hash, expires_at, attempt_count, consumed_at, superseded_at")
        .eq("user_id", user.id).eq("purpose", "setup")
        .is("consumed_at", null).is("superseded_at", null)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!otpRow) return json({ error: "No active code." }, 400);
      if (new Date(otpRow.expires_at) < new Date()) return json({ error: "Code expired." }, 410);
      if (otpRow.attempt_count >= 3) return json({ error: "Too many attempts." }, 429);
      const hash = await sha256Hex(submitted);
      if (hash !== otpRow.otp_hash) {
        await admin.from("auth_login_otps").update({ attempt_count: otpRow.attempt_count + 1 }).eq("id", otpRow.id);
        await recordAuthEvent(admin, { user_id: user.id, email: user.email, event_type: "otp_failed", ctx, metadata: { purpose: "setup" } });
        return json({ error: "Invalid code" }, 401);
      }
      await admin.from("auth_login_otps").update({ consumed_at: new Date().toISOString() }).eq("id", otpRow.id);

      // Mark email confirmed + setup completed + active status.
      try { await admin.auth.admin.updateUserById(user.id, { email_confirm: true }); } catch { /* ignore */ }
      await admin.from("profiles").update({
        security_setup_completed: true,
        account_status: "active",
      }).eq("id", user.id);

      // Consume activation token if used.
      if (payload.activationToken) {
        const tHash = await sha256Hex(String(payload.activationToken));
        await admin.from("auth_activation_tokens").update({ consumed_at: new Date().toISOString() }).eq("token_hash", tHash);
      }

      await recordAuthEvent(admin, { user_id: user.id, email: user.email, event_type: "security_setup_completed", ctx });
      return json({ success: true });
    }

    // One-shot activation: validate token, set password, mark active, consume token.
    // Email ownership is proven by clicking the activation link from the inbox, so no OTP is required.
    if (action === "complete-activation") {
      if (!payload.activationToken || typeof payload.activationToken !== "string") {
        return json({ error: "Missing activation token" }, 400);
      }
      const policyErr = validatePasswordPolicy(payload.password);
      if (policyErr) return json({ error: policyErr }, 400);

      const tHash = await sha256Hex(String(payload.activationToken));
      const { data: tokenRow } = await admin
        .from("auth_activation_tokens")
        .select("id, user_id, expires_at, consumed_at")
        .eq("token_hash", tHash)
        .maybeSingle();
      if (!tokenRow || tokenRow.consumed_at || new Date(tokenRow.expires_at) < new Date()) {
        return json({ error: "Activation link is invalid or has expired." }, 410);
      }

      const { error: updErr } = await admin.auth.admin.updateUserById(tokenRow.user_id, {
        password: payload.password,
        email_confirm: true,
      });
      if (updErr) return json({ error: "Failed to set password" }, 500);

      await admin.from("profiles").update({
        security_setup_completed: true,
        account_status: "active",
        must_reset_password: false,
      }).eq("id", tokenRow.user_id);

      await admin.from("auth_activation_tokens")
        .update({ consumed_at: new Date().toISOString() })
        .eq("id", tokenRow.id);

      await recordAuthEvent(admin, {
        user_id: tokenRow.user_id, email: user.email,
        event_type: "security_setup_completed", ctx, metadata: { via: "activation_link" },
      });
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "Internal server error" }, 500);
  }
});
