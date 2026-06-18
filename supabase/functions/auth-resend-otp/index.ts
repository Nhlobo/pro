// Resend OTP — throttled to 3 per user per active OTP cycle.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  adminClient, corsHeaders, json, generateNumericOtp, sha256Hex,
  extractEventContext, recordAuthEvent, brandedEmail,
} from "../_shared/auth-helpers.ts";
import { sendEmail } from "../_shared/email.ts";

const MAX_RESENDS = 3;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const ctx = extractEventContext(req);
  const admin = adminClient();
  try {
    const { email, purpose = "login" } = await req.json();
    if (!email) return json({ error: "Invalid request" }, 400);

    const { data: profile } = await admin.from("profiles")
      .select("id, email, account_status").ilike("email", email).maybeSingle();
    if (!profile) return json({ success: true }); // generic
    if (profile.account_status === "suspended" || profile.account_status === "disabled") {
      return json({ success: true });
    }

    const { data: current } = await admin.from("auth_login_otps")
      .select("id, resend_count")
      .eq("user_id", profile.id).eq("purpose", purpose)
      .is("consumed_at", null).is("superseded_at", null)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();

    if (current && current.resend_count >= MAX_RESENDS) {
      return json({ error: "Resend limit reached. Please start again." }, 429);
    }

    // Supersede prior
    await admin.from("auth_login_otps")
      .update({ superseded_at: new Date().toISOString() })
      .eq("user_id", profile.id).eq("purpose", purpose)
      .is("consumed_at", null).is("superseded_at", null);

    const otp = generateNumericOtp(6);
    const otpHash = await sha256Hex(otp);
    await admin.from("auth_login_otps").insert({
      user_id: profile.id, otp_hash: otpHash, purpose,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      resend_count: (current?.resend_count ?? 0) + 1,
    });

    await sendEmail({
      to: email,
      subject: `Your Medico-Legal Pro verification code: ${otp}`,
      html: brandedEmail("Your verification code", `
        <p>Your new code (expires in 5 minutes):</p>
        <p style="text-align:center; font-size:32px; letter-spacing:6px; font-weight:bold; color:#0f172a; margin:24px 0;">${otp}</p>
      `),
    });

    await recordAuthEvent(admin, { user_id: profile.id, email, event_type: "otp_resent", ctx, metadata: { purpose } });
    return json({ success: true });
  } catch (e) {
    console.error(e);
    return json({ error: "Internal server error" }, 500);
  }
});
