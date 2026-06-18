// auth-reset-password
// GET ?token= → validate.  POST {token,password} → consume + set new password.
// Does NOT mint a session: user must sign in via auth-login-start to get the OTP step.
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  corsHeaders, newCorrelationId, structuredLog, sha256Hex,
  extractContext, jsonResponse, validatePassword,
} from '../_shared/auth-helpers.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const cid = newCorrelationId('reset');
  const ctx = extractContext(req);
  const fn = 'auth-reset-password';
  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const url = new URL(req.url);
    let token: string | null = null;
    let newPassword: string | null = null;
    if (req.method === 'GET') {
      token = url.searchParams.get('token');
    } else if (req.method === 'POST') {
      const body = await req.json().catch(() => null);
      token = body?.token ?? null;
      newPassword = body?.password ?? null;
    } else {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }
    if (!token) return jsonResponse({ error: 'Missing token' }, 400);

    const tokenHash = await sha256Hex(token);
    const { data: row } = await admin
      .from('password_reset_tokens')
      .select('*')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (!row) return jsonResponse({ error: 'Invalid reset link' }, 400);
    if (row.consumed_at) return jsonResponse({ error: 'This reset link has already been used' }, 400);
    if (new Date(row.expires_at) < new Date()) return jsonResponse({ error: 'This reset link has expired' }, 400);

    if (req.method === 'GET') {
      const { data: profile } = await admin.from('profiles').select('email').eq('id', row.user_id).maybeSingle();
      return jsonResponse({ valid: true, email: profile?.email });
    }

    if (!newPassword) return jsonResponse({ error: 'Password is required' }, 400);
    const pw = validatePassword(newPassword);
    if (!pw.ok) return jsonResponse({ error: pw.reason }, 400);

    const { error: updErr } = await admin.auth.admin.updateUserById(row.user_id, { password: newPassword });
    if (updErr) {
      structuredLog('error', fn, cid, 'updateUser failed', { error: updErr.message });
      return jsonResponse({ error: 'Failed to update password' }, 500);
    }

    await admin.from('password_reset_tokens').update({ consumed_at: new Date().toISOString() }).eq('id', row.id);
    // Reset attempt counters; force re-login via OTP next time.
    await admin.from('profiles').update({
      failed_login_count: 0, locked_until: null,
      account_status: 'active',
    }).eq('id', row.user_id);
    // Revoke all existing sessions so any pre-existing devices must re-authenticate
    await admin.auth.admin.signOut(row.user_id, 'global').catch(() => {});

    await admin.rpc('log_auth_event', {
      _user_id: row.user_id, _event_type: 'password_reset_completed',
      _ip: ctx.ip, _user_agent: ctx.userAgent, _browser: ctx.browser, _os: ctx.os, _device: ctx.device,
      _metadata: { correlationId: cid },
    });
    await admin.rpc('log_auth_event', {
      _user_id: row.user_id, _event_type: 'password_changed',
      _ip: ctx.ip, _user_agent: ctx.userAgent, _browser: ctx.browser, _os: ctx.os, _device: ctx.device,
      _metadata: { correlationId: cid },
    });

    return jsonResponse({ success: true, message: 'Password updated. Please sign in.' });
  } catch (e) {
    structuredLog('error', fn, cid, 'unhandled', { error: String(e) });
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});
