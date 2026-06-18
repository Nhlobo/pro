// Complete password reset: consumes token, sets new password (server policy enforced),
// then requires OTP-on-next-login (no auto-session here).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  adminClient, corsHeaders, json, sha256Hex, validatePasswordPolicy,
  extractEventContext, recordAuthEvent,
} from "../_shared/auth-helpers.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const ctx = extractEventContext(req);
  const admin = adminClient();
  try {
    const { token, newPassword } = await req.json();
    if (!token || !newPassword) return json({ error: "Invalid request" }, 400);
    const policyErr = validatePasswordPolicy(newPassword);
    if (policyErr) return json({ error: policyErr }, 400);

    const hash = await sha256Hex(token);
    const { data: row } = await admin.from("auth_password_reset_tokens")
      .select("id, user_id, expires_at, consumed_at").eq("token_hash", hash).maybeSingle();
    if (!row || row.consumed_at || new Date(row.expires_at) < new Date()) {
      return json({ error: "This reset link is no longer valid." }, 410);
    }

    const { error: updErr } = await admin.auth.admin.updateUserById(row.user_id, { password: newPassword });
    if (updErr) return json({ error: "Failed to update password" }, 500);

    await admin.from("auth_password_reset_tokens").update({ consumed_at: new Date().toISOString() }).eq("id", row.id);
    await admin.from("profiles").update({ must_reset_password: false, failed_login_count: 0, locked_until: null }).eq("id", row.user_id);

    // Revoke all sessions for this user (force OTP login next time).
    await admin.from("auth_active_sessions")
      .update({ revoked_at: new Date().toISOString(), revoked_reason: "password_reset" })
      .eq("user_id", row.user_id).is("revoked_at", null);
    try { await admin.auth.admin.signOut(row.user_id); } catch { /* ignore */ }

    const { data: profile } = await admin.from("profiles").select("email").eq("id", row.user_id).maybeSingle();
    await recordAuthEvent(admin, { user_id: row.user_id, email: profile?.email ?? null, event_type: "password_reset_completed", ctx });

    return json({ success: true });
  } catch (e) {
    console.error(e);
    return json({ error: "Internal server error" }, 500);
  }
});
