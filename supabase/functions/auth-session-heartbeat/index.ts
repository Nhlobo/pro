// auth-session-heartbeat
// Validates the caller's bearer JWT, then checks that the supplied sessionMarker
// matches profiles.current_session_id. 401 → client should sign out + redirect.
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  corsHeaders, newCorrelationId, structuredLog, extractContext, jsonResponse,
} from '../_shared/auth-helpers.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const cid = newCorrelationId('heartbeat');
  const ctx = extractContext(req);
  const fn = 'auth-session-heartbeat';
  try {
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return jsonResponse({ error: 'Unauthorized' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims, error } = await supabase.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (error || !claims?.claims?.sub) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    const userId = claims.claims.sub as string;

    const body = await req.json().catch(() => null);
    const marker = body?.sessionMarker?.toString() ?? null;

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const { data: profile } = await admin
      .from('profiles')
      .select('current_session_id, account_status')
      .eq('id', userId)
      .maybeSingle();

    if (!profile) return jsonResponse({ error: 'Unauthorized' }, 401);
    if (profile.account_status === 'suspended' || profile.account_status === 'disabled') {
      return jsonResponse({ error: 'Account not active', code: 'account_inactive' }, 401);
    }
    if (profile.current_session_id && marker && profile.current_session_id !== marker) {
      structuredLog('info', fn, cid, 'session superseded', { userId });
      await admin.rpc('log_auth_event', {
        _user_id: userId, _event_type: 'session_expired',
        _ip: ctx.ip, _user_agent: ctx.userAgent, _browser: ctx.browser, _os: ctx.os, _device: ctx.device,
        _metadata: { correlationId: cid, reason: 'session_superseded' },
      });
      return jsonResponse({ error: 'Session superseded', code: 'session_superseded' }, 401);
    }

    return jsonResponse({ ok: true });
  } catch (e) {
    structuredLog('error', fn, cid, 'unhandled', { error: String(e) });
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});
