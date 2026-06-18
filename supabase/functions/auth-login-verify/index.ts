// auth-login-verify
// Step 2: validate OTP, revoke prior sessions (single-session), mint a real session.
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  corsHeaders, newCorrelationId, structuredLog, sha256Hex,
  extractContext, jsonResponse,
} from '../_shared/auth-helpers.ts';

const MAX_OTP_ATTEMPTS = 3;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const cid = newCorrelationId('login-verify');
  const ctx = extractContext(req);
  const fn = 'auth-login-verify';

  try {
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
    const body = await req.json().catch(() => null);
    const challengeId = body?.challengeId?.toString();
    const code = body?.code?.toString();
    if (!challengeId || !code || !/^\d{6}$/.test(code)) {
      return jsonResponse({ error: 'Invalid code' }, 400);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: otp, error: otpErr } = await admin
      .from('auth_otp_codes')
      .select('*')
      .eq('id', challengeId)
      .eq('purpose', 'login')
      .maybeSingle();

    if (otpErr || !otp || otp.consumed_at) {
      return jsonResponse({ error: 'Invalid or expired code' }, 400);
    }
    if (new Date(otp.expires_at) < new Date()) {
      return jsonResponse({ error: 'Code has expired. Please sign in again.' }, 400);
    }
    if (otp.attempts >= MAX_OTP_ATTEMPTS) {
      await admin.from('auth_otp_codes').update({ consumed_at: new Date().toISOString() }).eq('id', otp.id);
      return jsonResponse({ error: 'Too many attempts. Please sign in again.' }, 400);
    }

    const codeHash = await sha256Hex(code);
    if (codeHash !== otp.code_hash) {
      await admin.from('auth_otp_codes').update({ attempts: otp.attempts + 1 }).eq('id', otp.id);
      await admin.rpc('log_auth_event', {
        _user_id: otp.user_id, _event_type: 'otp_failed',
        _ip: ctx.ip, _user_agent: ctx.userAgent, _browser: ctx.browser, _os: ctx.os, _device: ctx.device,
        _metadata: { correlationId: cid, challengeId },
      });
      return jsonResponse({ error: 'Incorrect code' }, 400);
    }

    // Consume the OTP
    await admin.from('auth_otp_codes').update({ consumed_at: new Date().toISOString() }).eq('id', otp.id);

    // Load user
    const { data: userRes, error: uErr } = await admin.auth.admin.getUserById(otp.user_id);
    if (uErr || !userRes?.user?.email) {
      structuredLog('error', fn, cid, 'getUserById failed', { error: uErr?.message });
      return jsonResponse({ error: 'Authentication failed' }, 500);
    }
    const user = userRes.user;

    // Single-session: revoke all existing refresh tokens for this user.
    await admin.auth.admin.signOut(user.id, 'global').catch(() => {});

    // Mint a fresh session via magiclink hashed_token + verifyOtp
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email,
    });
    if (linkErr || !linkData?.properties?.hashed_token) {
      structuredLog('error', fn, cid, 'generateLink failed', { error: linkErr?.message });
      return jsonResponse({ error: 'Authentication failed' }, 500);
    }

    const verifier = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const { data: vData, error: vErr } = await verifier.auth.verifyOtp({
      type: 'magiclink',
      token_hash: linkData.properties.hashed_token,
    });
    if (vErr || !vData?.session) {
      structuredLog('error', fn, cid, 'verifyOtp failed', { error: vErr?.message });
      return jsonResponse({ error: 'Authentication failed' }, 500);
    }

    const sessionMarker = crypto.randomUUID();
    await admin
      .from('profiles')
      .update({
        current_session_id: sessionMarker,
        failed_login_count: 0,
        locked_until: null,
        account_status: 'active',
      })
      .eq('id', user.id);

    await admin.rpc('log_auth_event', {
      _user_id: user.id, _event_type: 'otp_verified',
      _ip: ctx.ip, _user_agent: ctx.userAgent, _browser: ctx.browser, _os: ctx.os, _device: ctx.device,
      _metadata: { correlationId: cid },
    });
    await admin.rpc('log_auth_event', {
      _user_id: user.id, _event_type: 'login_success',
      _ip: ctx.ip, _user_agent: ctx.userAgent, _browser: ctx.browser, _os: ctx.os, _device: ctx.device,
      _metadata: { correlationId: cid, sessionMarker },
    });

    return jsonResponse({
      session: {
        access_token: vData.session.access_token,
        refresh_token: vData.session.refresh_token,
        expires_at: vData.session.expires_at,
        expires_in: vData.session.expires_in,
        token_type: vData.session.token_type,
      },
      sessionMarker,
      userId: user.id,
    });
  } catch (e) {
    structuredLog('error', fn, cid, 'unhandled', { error: String(e) });
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});
