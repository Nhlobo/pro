// Admin actions. Single endpoint, switched by `action`.
// Actions:
//   suspend, reactivate, disable, unlock, resend-activation,
//   force-reset, force-setup, force-logout-all
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  adminClient, corsHeaders, json, requireAdmin, generateRandomToken, sha256Hex,
  extractEventContext, recordAuthEvent, appBaseUrl, brandedEmail,
} from "../_shared/auth-helpers.ts";
import { sendEmail } from "../_shared/email.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;
  const ctx = extractEventContext(req);
  const admin = adminClient();
  try {
    const { action, userId } = await req.json();
    if (!action || !userId) return json({ error: "Missing action or userId" }, 400);

    const { data: profile } = await admin.from("profiles").select("id, email, first_name").eq("id", userId).maybeSingle();
    if (!profile) return json({ error: "User not found" }, 404);

    const revokeSessions = async (reason: string) => {
      await admin.from("auth_active_sessions")
        .update({ revoked_at: new Date().toISOString(), revoked_reason: reason })
        .eq("user_id", userId).is("revoked_at", null);
      try { await admin.auth.admin.signOut(userId); } catch { /* ignore */ }
    };

    switch (action) {
      case "suspend":
        await admin.from("profiles").update({ account_status: "suspended" }).eq("id", userId);
        await revokeSessions("admin_suspend");
        await recordAuthEvent(admin, { user_id: userId, email: profile.email, event_type: "account_suspended", ctx, metadata: { by: guard.userId } });
        break;
      case "reactivate":
        await admin.from("profiles").update({ account_status: "active", failed_login_count: 0, locked_until: null }).eq("id", userId);
        await recordAuthEvent(admin, { user_id: userId, email: profile.email, event_type: "account_reactivated", ctx, metadata: { by: guard.userId } });
        break;
      case "disable":
        await admin.from("profiles").update({ account_status: "disabled" }).eq("id", userId);
        await revokeSessions("admin_disable");
        await recordAuthEvent(admin, { user_id: userId, email: profile.email, event_type: "account_disabled", ctx, metadata: { by: guard.userId } });
        break;
      case "unlock":
        await admin.from("profiles").update({ failed_login_count: 0, locked_until: null }).eq("id", userId);
        await recordAuthEvent(admin, { user_id: userId, email: profile.email, event_type: "account_unlocked", ctx, metadata: { by: guard.userId } });
        break;
      case "force-reset":
        await admin.from("profiles").update({ must_reset_password: true }).eq("id", userId);
        await revokeSessions("admin_force_reset");
        await recordAuthEvent(admin, { user_id: userId, email: profile.email, event_type: "password_reset_forced", ctx, metadata: { by: guard.userId } });
        break;
      case "force-setup":
        await admin.from("profiles").update({ security_setup_completed: false }).eq("id", userId);
        await revokeSessions("admin_force_setup");
        await recordAuthEvent(admin, { user_id: userId, email: profile.email, event_type: "security_setup_reset", ctx, metadata: { by: guard.userId } });
        break;
      case "force-logout-all":
        await revokeSessions("admin_force_logout");
        await recordAuthEvent(admin, { user_id: userId, email: profile.email, event_type: "forced_logout", ctx, metadata: { by: guard.userId } });
        break;
      case "resend-activation": {
        const raw = generateRandomToken(32);
        const hash = await sha256Hex(raw);
        await admin.from("auth_activation_tokens").insert({
          user_id: userId, token_hash: hash,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          created_by: guard.userId,
        });
        const url = `${appBaseUrl()}/activate?token=${raw}`;
        if (profile.email) {
          await sendEmail({
            to: profile.email,
            subject: "Your Medico-Legal Pro activation link",
            html: brandedEmail("Activate Your Account", `
              <p>A new activation link has been issued. It expires in 24 hours.</p>
              <div style="text-align:center; margin:24px 0;">
                <a href="${url}" style="background-color:#0ea5e9; color:#ffffff; padding:12px 24px; text-decoration:none; border-radius:6px; font-weight:bold;">Activate Account</a>
              </div>
              <p style="font-size:11px; word-break:break-all; color:#0284c7;">${url}</p>
            `),
          });
        }
        await recordAuthEvent(admin, { user_id: userId, email: profile.email, event_type: "activation_resent", ctx, metadata: { by: guard.userId } });
        break;
      }
      default:
        return json({ error: "Unknown action" }, 400);
    }

    return json({ success: true });
  } catch (e) {
    console.error(e);
    return json({ error: "Internal server error" }, 500);
  }
});
