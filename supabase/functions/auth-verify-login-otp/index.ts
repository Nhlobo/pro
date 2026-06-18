// Step 2 of login: verify OTP, then issue a real session via signInWithPassword.
// Frontend supplies email+password again — they were already verified once in step 1,
// but we re-use them to mint the session that the browser stores. The OTP is what
// gates the second factor.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  adminClient, corsHeaders, json, sha256Hex, generateRandomToken,
  extractEventContext, recordAuthEvent,
} from "../_shared/auth-helpers.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_ATTEMPTS = 3;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const ctx = extractEventContext(req);
  const admin = adminClient();

  try {
    const { email, password, otp } = await req.json();
    if (!email || !password || !otp) return json({ error: "Invalid request" }, 400);

    const { data: profile } = await admin.from("profiles")
      .select("id, email, account_status, security_setup_completed, must_reset_password")
      .ilike("email", email).maybeSingle();
    if (!profile) return json({ error: "Invalid code" }, 401);
    if (profile.account_status === "suspended" || profile.account_status === "disabled") {
      return json({ error: "Account not available." }, 403);
    }

    const { data: otpRow } = await admin.from("auth_login_otps")
      .select("id, otp_hash, expires_at, attempt_count, consumed_at, superseded_at")
      .eq("user_id", profile.id).eq("purpose", "login")
      .is("consumed_at", null).is("superseded_at", null)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();

    if (!otpRow) return json({ error: "No active code. Please request a new one." }, 400);
    if (new Date(otpRow.expires_at) < new Date()) {
      await admin.from("auth_login_otps").update({ superseded_at: new Date().toISOString() }).eq("id", otpRow.id);
      return json({ error: "Code expired. Please request a new one." }, 410);
    }
    if (otpRow.attempt_count >= MAX_ATTEMPTS) {
      await admin.from("auth_login_otps").update({ superseded_at: new Date().toISOString() }).eq("id", otpRow.id);
      return json({ error: "Too many attempts. Please request a new code." }, 429);
    }

    const submittedHash = await sha256Hex(otp);
    if (submittedHash !== otpRow.otp_hash) {
      await admin.from("auth_login_otps").update({ attempt_count: otpRow.attempt_count + 1 }).eq("id", otpRow.id);
      await recordAuthEvent(admin, { user_id: profile.id, email, event_type: "otp_failed", ctx });
      return json({ error: "Invalid code" }, 401);
    }

    // OTP valid — mark consumed.
    await admin.from("auth_login_otps").update({ consumed_at: new Date().toISOString() }).eq("id", otpRow.id);

    // Issue session via password sign-in (this is the session the browser will use).
    const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: signInData, error: signInErr } = await anon.auth.signInWithPassword({ email, password });
    if (signInErr || !signInData.session) {
      await recordAuthEvent(admin, { user_id: profile.id, email, event_type: "login_failed", ctx, metadata: { reason: "password_changed_during_otp" } });
      return json({ error: "Sign-in failed. Please start again." }, 401);
    }

    // Single-session: revoke any prior active sessions for this user.
    await admin.from("auth_active_sessions")
      .update({ revoked_at: new Date().toISOString(), revoked_reason: "superseded_by_new_login" })
      .eq("user_id", profile.id).is("revoked_at", null);

    const sessionToken = generateRandomToken(24);
    const eightHours = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
    await admin.from("auth_active_sessions").insert({
      user_id: profile.id, session_token: sessionToken, expires_at: eightHours,
      ip: ctx.ip, user_agent: ctx.user_agent,
    });

    await recordAuthEvent(admin, { user_id: profile.id, email, event_type: "login", ctx });

    return json({
      success: true,
      session: signInData.session,
      session_token: sessionToken,
      security_setup_completed: profile.security_setup_completed,
      must_reset_password: profile.must_reset_password,
    });
  } catch (e: any) {
    console.error(e);
    return json({ error: "Internal server error" }, 500);
  }
});
