// auth-activate-account
// Validates an activation token (GET), then on POST consumes it, sets the new password,
// returns a fresh session and marks the wizard complete (account activated path).
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  corsHeaders, newCorrelationId, structuredLog, sha256Hex,
  extractContext, jsonResponse, validatePassword,
} from '../_shared/auth-helpers.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const cid = newCorrelationId('activate');
  const ctx = extractContext(req);
  const fn = 'auth-activate-account';
  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || (req.method === 'GET' ? 'validate' : 'consume');

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
      .from('account_activations')
      .select('*')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (!row) return jsonResponse({ error: 'Invalid activation link' }, 400);
    if (row.consumed_at) return jsonResponse({ error: 'This activation link has already been used' }, 400);
    if (new Date(row.expires_at) < new Date()) return jsonResponse({ error: 'This activation link has expired' }, 400);

    if (action === 'validate' || req.method === 'GET') {
      const { data: profile } = await admin.from('profiles').select('email, first_name, last_name').eq('id', row.user_id).maybeSingle();
      return jsonResponse({ valid: true, email: profile?.email, firstName: profile?.first_name, lastName: profile?.last_name });
    }

    if (!newPassword) return jsonResponse({ error: 'Password is required' }, 400);
    const pw = validatePassword(newPassword);
    if (!pw.ok) return jsonResponse({ error: pw.reason }, 400);

    // Set the password
    const { error: updErr } = await admin.auth.admin.updateUserById(row.user_id, {
      password: newPassword,
      email_confirm: true,
    });
    if (updErr) {
      structuredLog('error', fn, cid, 'updateUser failed', { error: updErr.message });
      return jsonResponse({ error: 'Failed to set password' }, 500);
    }

    // Consume token
    await admin.from('account_activations').update({ consumed_at: new Date().toISOString() }).eq('id', row.id);

    // Mark profile activated + security setup complete (activation already covers the wizard)
    await admin.from('profiles').update({
      account_status: 'active',
      security_setup_completed_at: new Date().toISOString(),
      force_security_setup: false,
      failed_login_count: 0,
      locked_until: null,
    }).eq('id', row.user_id);

    await admin.rpc('log_auth_event', {
      _user_id: row.user_id, _event_type: 'account_activated',
      _ip: ctx.ip, _user_agent: ctx.userAgent, _browser: ctx.browser, _os: ctx.os, _device: ctx.device,
      _metadata: { correlationId: cid },
    });
    await admin.rpc('log_auth_event', {
      _user_id: row.user_id, _event_type: 'password_created',
      _ip: ctx.ip, _user_agent: ctx.userAgent, _browser: ctx.browser, _os: ctx.os, _device: ctx.device,
      _metadata: { correlationId: cid },
    });
    await admin.rpc('log_auth_event', {
      _user_id: row.user_id, _event_type: 'security_setup_completed',
      _ip: ctx.ip, _user_agent: ctx.userAgent, _browser: ctx.browser, _os: ctx.os, _device: ctx.device,
      _metadata: { correlationId: cid, via: 'activation' },
    });

    return jsonResponse({ success: true, message: 'Account activated. Please sign in.' });
  } catch (e) {
    structuredLog('error', fn, cid, 'unhandled', { error: String(e) });
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});
