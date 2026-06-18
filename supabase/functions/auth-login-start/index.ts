// auth-login-start
// Step 1 of email-OTP login: verify password, lock after 3 fails, send OTP.
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  corsHeaders, newCorrelationId, structuredLog, sha256Hex, generateOtp,
  extractContext, jsonResponse, isValidEmail,
} from '../_shared/auth-helpers.ts';
import { sendLoginOtpEmail, sendLockoutAdminEmail } from '../_shared/auth-emails.ts';

const MAX_FAILED = 3;
const LOCKOUT_MINUTES = 30;
const OTP_TTL_MINUTES = 5;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const cid = newCorrelationId('login-start');
  const ctx = extractContext(req);
  const fn = 'auth-login-start';

  try {
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

    const body = await req.json().catch(() => null);
    const email = body?.email?.toString().trim().toLowerCase();
    const password = body?.password;
    if (!isValidEmail(email) || typeof password !== 'string' || password.length === 0) {
      return jsonResponse({ error: 'Email and password are required' }, 400);
    }
    structuredLog('info', fn, cid, 'login attempt', { email, ip: ctx.ip });

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Look up user
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (listErr) {
      structuredLog('error', fn, cid, 'listUsers failed', { error: listErr.message });
      return jsonResponse({ error: 'Authentication failed' }, 500);
    }
    const user = list.users.find((u) => u.email?.toLowerCase() === email);
    if (!user) {
      // Generic error to prevent enumeration
      structuredLog('warn', fn, cid, 'no such user', { email });
      return jsonResponse({ error: 'Invalid email or password' }, 401);
    }

    // Load profile
    const { data: profile } = await admin
      .from('profiles')
      .select('id, email, first_name, last_name, account_status, locked_until, failed_login_count')
      .eq('id', user.id)
      .maybeSingle();

    const status = profile?.account_status ?? 'active';
    if (status === 'suspended' || status === 'disabled') {
      structuredLog('warn', fn, cid, 'account not active', { userId: user.id, status });
      await admin.rpc('log_auth_event', {
        _user_id: user.id, _event_type: 'login_failed',
        _ip: ctx.ip, _user_agent: ctx.userAgent, _browser: ctx.browser, _os: ctx.os, _device: ctx.device,
        _metadata: { reason: 'account_' + status, correlationId: cid },
      });
      return jsonResponse({ error: 'This account is not currently active. Contact your administrator.' }, 403);
    }
    if (status === 'pending_activation') {
      return jsonResponse({ error: 'This account has not been activated yet. Please check your email for the activation link.' }, 403);
    }
    if (status === 'locked' && profile?.locked_until && new Date(profile.locked_until) > new Date()) {
      return jsonResponse({ error: 'This account is temporarily locked. Try again later or contact your administrator.' }, 423);
    }

    // Verify password using a scratch anon client
    const scratch = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const { data: pwOk, error: pwErr } = await scratch.auth.signInWithPassword({ email, password });
    if (pwErr || !pwOk?.session) {
      const newCount = (profile?.failed_login_count ?? 0) + 1;
      const updates: Record<string, unknown> = {
        failed_login_count: newCount,
        last_failed_login_at: new Date().toISOString(),
      };
      let locked = false;
      if (newCount >= MAX_FAILED) {
        updates.account_status = 'locked';
        updates.locked_until = new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString();
        locked = true;
      }
      await admin.from('profiles').update(updates).eq('id', user.id);
      await admin.rpc('log_auth_event', {
        _user_id: user.id, _event_type: locked ? 'account_locked' : 'login_failed',
        _ip: ctx.ip, _user_agent: ctx.userAgent, _browser: ctx.browser, _os: ctx.os, _device: ctx.device,
        _metadata: { correlationId: cid, failedCount: newCount },
      });
      structuredLog('warn', fn, cid, 'password failed', { userId: user.id, newCount, locked });

      if (locked) {
        // Notify admins
        const { data: admins } = await admin
          .from('user_roles')
          .select('user_id')
          .eq('role', 'admin');
        if (admins && admins.length > 0) {
          const ids = admins.map((r: any) => r.user_id);
          const { data: adminProfiles } = await admin.from('profiles').select('email').in('id', ids);
          const adminEmails = (adminProfiles ?? []).map((p: any) => p.email).filter(Boolean);
          if (adminEmails.length > 0) {
            await sendLockoutAdminEmail(adminEmails, user.email!, ctx.ip).catch((e) =>
              structuredLog('error', fn, cid, 'lockout admin email failed', { error: String(e) }),
            );
          }
        }
        return jsonResponse({ error: 'Account locked due to repeated failed attempts. An administrator has been notified.' }, 423);
      }
      return jsonResponse({ error: 'Invalid email or password' }, 401);
    }

    // Sign out the scratch session immediately so it can't be reused
    await scratch.auth.signOut().catch(() => {});

    // Reset fail counter
    await admin.from('profiles').update({ failed_login_count: 0, last_failed_login_at: null }).eq('id', user.id);

    // Generate OTP, hash, invalidate prior active OTPs
    const code = generateOtp();
    const codeHash = await sha256Hex(code);
    await admin
      .from('auth_otp_codes')
      .update({ consumed_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('purpose', 'login')
      .is('consumed_at', null);

    const { data: otpRow, error: otpErr } = await admin
      .from('auth_otp_codes')
      .insert({
        user_id: user.id,
        code_hash: codeHash,
        purpose: 'login',
        expires_at: new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString(),
      })
      .select('id')
      .single();
    if (otpErr || !otpRow) {
      structuredLog('error', fn, cid, 'otp insert failed', { error: otpErr?.message });
      return jsonResponse({ error: 'Failed to generate sign-in code' }, 500);
    }

    const emailRes = await sendLoginOtpEmail(user.email!, code, profile?.first_name ?? null);
    if (!emailRes.success) {
      structuredLog('error', fn, cid, 'otp email failed', { error: emailRes.error });
      return jsonResponse({ error: 'Failed to send sign-in code email' }, 500);
    }

    await admin.rpc('log_auth_event', {
      _user_id: user.id, _event_type: 'otp_sent',
      _ip: ctx.ip, _user_agent: ctx.userAgent, _browser: ctx.browser, _os: ctx.os, _device: ctx.device,
      _metadata: { correlationId: cid, purpose: 'login' },
    });

    structuredLog('info', fn, cid, 'otp sent', { userId: user.id });
    return jsonResponse({ challengeId: otpRow.id, email: user.email });
  } catch (e) {
    structuredLog('error', fn, cid, 'unhandled', { error: String(e) });
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});
