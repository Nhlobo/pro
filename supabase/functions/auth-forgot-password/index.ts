// auth-forgot-password
// Always returns 200 (no enumeration). Issues reset link if the account exists & is usable.
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  corsHeaders, newCorrelationId, structuredLog, sha256Hex, generateUrlToken,
  extractContext, jsonResponse, isValidEmail,
} from '../_shared/auth-helpers.ts';
import { sendPasswordResetEmail } from '../_shared/auth-emails.ts';

const RESET_TTL_MINUTES = 60;
const RESET_BASE_URL = 'https://kamedico-legal.co.za/reset-password';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const cid = newCorrelationId('forgot');
  const ctx = extractContext(req);
  const fn = 'auth-forgot-password';
  const generic = jsonResponse({ success: true, message: 'If an account exists, a reset email has been sent.' });
  try {
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
    const body = await req.json().catch(() => null);
    const email = body?.email?.toString().trim().toLowerCase();
    if (!isValidEmail(email)) return generic;

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const user = list?.users.find((u) => u.email?.toLowerCase() === email);
    if (!user) {
      structuredLog('info', fn, cid, 'no user', { email });
      return generic;
    }

    const { data: profile } = await admin.from('profiles').select('account_status, first_name').eq('id', user.id).maybeSingle();
    if (profile?.account_status === 'suspended' || profile?.account_status === 'disabled' || profile?.account_status === 'pending_activation') {
      structuredLog('info', fn, cid, 'account not eligible', { status: profile?.account_status });
      return generic;
    }

    const token = generateUrlToken(32);
    const tokenHash = await sha256Hex(token);
    await admin.from('password_reset_tokens').insert({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + RESET_TTL_MINUTES * 60_000).toISOString(),
    });

    const link = `${RESET_BASE_URL}?token=${encodeURIComponent(token)}`;
    await sendPasswordResetEmail(user.email!, link, profile?.first_name ?? null).catch((e) =>
      structuredLog('error', fn, cid, 'reset email failed', { error: String(e) }),
    );

    await admin.rpc('log_auth_event', {
      _user_id: user.id, _event_type: 'password_reset_requested',
      _ip: ctx.ip, _user_agent: ctx.userAgent, _browser: ctx.browser, _os: ctx.os, _device: ctx.device,
      _metadata: { correlationId: cid },
    });

    return generic;
  } catch (e) {
    structuredLog('error', fn, cid, 'unhandled', { error: String(e) });
    return generic;
  }
});
