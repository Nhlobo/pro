// Public — always returns generic success. Emails a reset link if account exists.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  adminClient, corsHeaders, json, generateRandomToken, sha256Hex,
  extractEventContext, recordAuthEvent, appBaseUrl, brandedEmail,
} from "../_shared/auth-helpers.ts";
import { sendEmail } from "../_shared/email.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const ctx = extractEventContext(req);
  const admin = adminClient();
  try {
    const { email } = await req.json();
    if (!email) return json({ success: true });

    const { data: profile } = await admin.from("profiles")
      .select("id, email, account_status, first_name").ilike("email", email).maybeSingle();

    if (profile && profile.account_status !== "disabled" && profile.account_status !== "suspended") {
      const raw = generateRandomToken(32);
      const hash = await sha256Hex(raw);
      await admin.from("auth_password_reset_tokens").insert({
        user_id: profile.id, token_hash: hash,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });
      const url = `${appBaseUrl()}/reset-password?token=${raw}`;
      await sendEmail({
        to: profile.email,
        subject: "Reset your Medico-Legal Pro password",
        html: brandedEmail("Reset your password", `
          <p>Hello${profile.first_name ? " " + profile.first_name : ""},</p>
          <p>Click below to choose a new password. This link expires in 1 hour and can be used once.</p>
          <div style="text-align:center; margin:24px 0;">
            <a href="${url}" style="background-color:#0ea5e9; color:#ffffff; padding:12px 24px; text-decoration:none; border-radius:6px; font-weight:bold;">Reset Password</a>
          </div>
          <p style="font-size:11px; word-break:break-all; color:#0284c7;">${url}</p>
        `),
      });
      await recordAuthEvent(admin, { user_id: profile.id, email: profile.email, event_type: "password_reset_requested", ctx });
    }

    return json({ success: true });
  } catch (e) {
    console.error(e);
    return json({ success: true });
  }
});
