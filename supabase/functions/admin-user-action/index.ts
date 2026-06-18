// admin-user-action
// Admin-only dispatcher: suspend, reactivate, unlock, disable, resend_activation,
// force_password_reset, force_security_setup, force_logout_all.
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  corsHeaders, newCorrelationId, structuredLog, sha256Hex, generateUrlToken,
  extractContext, jsonResponse,
} from '../_shared/auth-helpers.ts';
import { sendActivationEmail, sendPasswordResetEmail } from '../_shared/auth-emails.ts';

const ACTIVATION_TTL_HOURS = 24;
const RESET_TTL_MINUTES = 60;
const ACTIVATION_BASE_URL = 'https://kamedico-legal.co.za/activate';
const RESET_BASE_URL = 'https://kamedico-legal.co.za/reset-password';

const ACTIONS = new Set([
  'suspend', 'reactivate', 'unlock', 'disable',
  'resend_activation', 'force_password_reset',
  'force_security_setup', 'force_logout_all',
]);

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const cid = newCorrelationId('admin-action');
  const ctx = extractContext(req);
  const fn = 'admin-user-action';
  try {
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return jsonResponse({ error: 'Unauthorized' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const caller = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user: callerUser } } = await caller.auth.getUser();
    if (!callerUser) return jsonResponse({ error: 'Unauthorized' }, 401);
    const { data: isAdmin } = await caller.rpc('has_role', { _user_id: callerUser.id, _role: 'admin' });
    if (!isAdmin) return jsonResponse({ error: 'Admin privileges required' }, 403);

    const body = await req.json().catch(() => null);
    const action = body?.action?.toString();
    const userId = body?.userId?.toString();
    if (!ACTIONS.has(action) || !userId) return jsonResponse({ error: 'Invalid action or userId' }, 400);

    const { data: profile } = await admin
      .from('profiles')
      .select('id, email, first_name')
      .eq('id', userId)
      .maybeSingle();
    if (!profile?.email) return jsonResponse({ error: 'User not found' }, 404);

    const logEvent = async (event: string, metadata: Record<string, unknown> = {}) => {
      await admin.rpc('log_auth_event', {
        _user_id: userId, _event_type: event,
        _ip: ctx.ip, _user_agent: ctx.userAgent, _browser: ctx.browser, _os: ctx.os, _device: ctx.device,
        _metadata: { correlationId: cid, performedBy: callerUser.id, ...metadata },
      });
    };

    switch (action) {
      case 'suspend':
        await admin.from('profiles').update({ account_status: 'suspended' }).eq('id', userId);
        await admin.auth.admin.signOut(userId, 'global').catch(() => {});
        await logEvent('account_suspended');
        break;
      case 'reactivate':
        await admin.from('profiles').update({
          account_status: 'active', locked_until: null, failed_login_count: 0,
        }).eq('id', userId);
        await logEvent('account_reactivated');
        break;
      case 'unlock':
        await admin.from('profiles').update({
          account_status: 'active', locked_until: null, failed_login_count: 0,
        }).eq('id', userId);
        await logEvent('account_unlocked');
        break;
      case 'disable':
        await admin.from('profiles').update({ account_status: 'disabled' }).eq('id', userId);
        await admin.auth.admin.signOut(userId, 'global').catch(() => {});
        await logEvent('account_suspended', { variant: 'disabled' });
        break;
      case 'force_logout_all':
        await admin.auth.admin.signOut(userId, 'global').catch(() => {});
        await admin.from('profiles').update({ current_session_id: null }).eq('id', userId);
        await logEvent('forced_logout');
        break;
      case 'force_security_setup':
        await admin.from('profiles').update({
          force_security_setup: true, security_setup_completed_at: null,
        }).eq('id', userId);
        await logEvent('account_reactivated', { variant: 'force_security_setup' });
        break;
      case 'resend_activation': {
        const token = generateUrlToken(32);
        const tokenHash = await sha256Hex(token);
        await admin.from('account_activations').insert({
          user_id: userId,
          token_hash: tokenHash,
          expires_at: new Date(Date.now() + ACTIVATION_TTL_HOURS * 3_600_000).toISOString(),
          created_by: callerUser.id,
        });
        await admin.from('profiles').update({ account_status: 'pending_activation' }).eq('id', userId);
        const link = `${ACTIVATION_BASE_URL}?token=${encodeURIComponent(token)}`;
        await sendActivationEmail(profile.email, link).catch(() => {});
        await logEvent('activation_link_sent');
        break;
      }
      case 'force_password_reset': {
        const token = generateUrlToken(32);
        const tokenHash = await sha256Hex(token);
        await admin.from('password_reset_tokens').insert({
          user_id: userId,
          token_hash: tokenHash,
          expires_at: new Date(Date.now() + RESET_TTL_MINUTES * 60_000).toISOString(),
        });
        const link = `${RESET_BASE_URL}?token=${encodeURIComponent(token)}`;
        await sendPasswordResetEmail(profile.email, link, profile.first_name ?? null).catch(() => {});
        await admin.auth.admin.signOut(userId, 'global').catch(() => {});
        await logEvent('password_reset_requested', { forcedByAdmin: true });
        break;
      }
    }

    structuredLog('info', fn, cid, 'admin action complete', { action, userId });
    return jsonResponse({ success: true });
  } catch (e) {
    structuredLog('error', fn, cid, 'unhandled', { error: String(e) });
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});
