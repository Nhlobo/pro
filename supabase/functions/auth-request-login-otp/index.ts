// Step 1 of login: verifies email+password, mints+emails an OTP.
// Does NOT issue a session.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  adminClient, corsHeaders, json, generateNumericOtp, sha256Hex,
  extractEventContext, recordAuthEvent, brandedEmail,
} from "../_shared/auth-helpers.ts";
import { sendEmail } from "../_shared/email.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_FAILS = 3;
const LOCK_MINUTES = 15;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const ctx = extractEventContext(req);
  const admin = adminClient();

  try {
    const { email, password } = await req.json();
    if (!email || !password) return json({ error: "Invalid credentials" }, 400);

    // Look up profile by email
    const { data: profile } = await admin.from("profiles")
      .select("id, email, account_status, failed_login_count, locked_until, security_setup_completed, must_reset_password")
      .ilike("email", email).maybeSingle();

    if (!profile) {
      // generic message - no enumeration
      await recordAuthEvent(admin, { user_id: null, email, event_type: "login_failed", ctx, metadata: { reason: "no_account" } });
      return json({ error: "Invalid credentials" }, 401);
    }

    if (profile.account_status === "suspended" || profile.account_status === "disabled") {
      await recordAuthEvent(admin, { user_id: profile.id, email, event_type: "login_blocked", ctx, metadata: { status: profile.account_status } });
      return json({ error: "This account is not available. Please contact your administrator." }, 403);
    }

    if (profile.locked_until && new Date(profile.locked_until) > new Date()) {
      return json({ error: "Account temporarily locked due to repeated failed attempts. Please try again later." }, 423);
    }

    // Verify password by attempting a sign-in via anon client (does not persist session).
    const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: signInData, error: signInErr } = await anon.auth.signInWithPassword({ email, password });
    if (signInErr || !signInData.session) {
      const newCount = (profile.failed_login_count ?? 0) + 1;
      const updates: Record<string, unknown> = { failed_login_count: newCount };
      let locked = false;
      if (newCount >= MAX_FAILS) {
        updates.locked_until = new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString();
        updates.failed_login_count = 0;
        locked = true;
      }
      await admin.from("profiles").update(updates).eq("id", profile.id);
      await recordAuthEvent(admin, {
        user_id: profile.id, email, event_type: locked ? "account_locked" : "login_failed", ctx,
        metadata: { reason: "bad_password", attempt: newCount },
      });
      if (locked) {
        // Notify admins via existing notifications table
        const { data: admins } = await admin.from("user_roles").select("user_id").eq("role", "admin");
        if (admins) {
          const rows = admins.map((a) => ({
            user_id: a.user_id,
            type: "security",
            title: "Account locked",
            message: `Account ${email} has been locked after ${MAX_FAILS} failed login attempts.`,
            read: false,
          }));
          await admin.from("notifications").insert(rows);
        }
        return json({ error: "Account temporarily locked due to repeated failed attempts." }, 423);
      }
      return json({ error: "Invalid credentials" }, 401);
    }

    // Invalidate the just-created session immediately (we don't want it client-side).
    try {
      await admin.auth.admin.signOut(signInData.session.access_token);
    } catch { /* ignore */ }

    // Reset failure counter and mint OTP.
    await admin.from("profiles").update({ failed_login_count: 0, locked_until: null }).eq("id", profile.id);

    // Supersede any previous OTPs.
    await admin.from("auth_login_otps")
      .update({ superseded_at: new Date().toISOString() })
      .eq("user_id", profile.id).is("consumed_at", null).is("superseded_at", null);

    const otp = generateNumericOtp(6);
    const otpHash = await sha256Hex(otp);
    await admin.from("auth_login_otps").insert({
      user_id: profile.id, otp_hash: otpHash, purpose: "login",
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });

    await sendEmail({
      to: email,
      subject: `Your Medico-Legal Pro verification code: ${otp}`,
      html: brandedEmail("Your verification code", `
        <p>Use the code below to complete sign-in. It expires in 5 minutes.</p>
        <p style="text-align:center; font-size:32px; letter-spacing:6px; font-weight:bold; color:#0f172a; margin:24px 0;">${otp}</p>
        <p style="font-size:12px; color:#64748b;">If you did not attempt to sign in, change your password immediately.</p>
      `),
    });

    await recordAuthEvent(admin, { user_id: profile.id, email, event_type: "otp_sent", ctx, metadata: { purpose: "login" } });

    return json({
      success: true,
      user_id: profile.id,
      must_reset_password: profile.must_reset_password,
      security_setup_completed: profile.security_setup_completed,
    });
  } catch (e: any) {
    console.error(e);
    return json({ error: "Internal server error" }, 500);
  }
});
