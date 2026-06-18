// admin-create-user
// Admin-only. Creates auth user with random unguessable password, profile in pending_activation,
// assigns role, generates activation token, emails it.
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  corsHeaders, newCorrelationId, structuredLog, sha256Hex, generateUrlToken,
  extractContext, jsonResponse, isValidEmail,
} from '../_shared/auth-helpers.ts';
import { sendActivationEmail } from '../_shared/auth-emails.ts';

const ACTIVATION_TTL_HOURS = 24;
const VALID_ROLES = ['admin', 'employee', 'sales_consultant', 'finance', 'director', 'user', 'referring_attorney'];
const ACTIVATION_BASE_URL = 'https://kamedico-legal.co.za/activate';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const cid = newCorrelationId('admin-create');
  const ctx = extractContext(req);
  const fn = 'admin-create-user';
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
    const email = body?.email?.toString().trim().toLowerCase();
    const firstName = body?.firstName?.toString().trim();
    const lastName = body?.lastName?.toString().trim();
    const role = body?.role?.toString() || 'user';
    const userType = body?.userType?.toString() || 'user';
    const position = body?.position?.toString() || null;
    const lawFirmId = body?.lawFirmId || null;
    const permissions: string[] = Array.isArray(body?.permissions) ? body.permissions : [];

    if (!isValidEmail(email) || !firstName || !lastName) {
      return jsonResponse({ error: 'Missing required fields' }, 400);
    }
    if (!VALID_ROLES.includes(role)) {
      return jsonResponse({ error: 'Invalid role' }, 400);
    }

    // Random unguessable password (never returned)
    const randomPassword = generateUrlToken(32) + 'Aa1!';

    const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: randomPassword,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName },
    });
    if (createErr || !newUser?.user) {
      structuredLog('error', fn, cid, 'createUser failed', { error: createErr?.message });
      return jsonResponse({ error: createErr?.message || 'Failed to create user' }, 400);
    }

    // Profile
    await admin.from('profiles').upsert({
      id: newUser.user.id,
      email,
      first_name: firstName,
      last_name: lastName,
      role,
      user_type: userType,
      position,
      law_firm_id: lawFirmId,
      account_status: 'pending_activation',
      security_setup_completed_at: null,
    });

    // Role
    await admin.from('user_roles').insert({
      user_id: newUser.user.id,
      role,
      granted_by: callerUser.id,
    });

    // Permissions (non-admin only)
    if (role !== 'admin' && permissions.length > 0) {
      for (const p of permissions) {
        await admin.from('user_permissions').upsert({
          user_id: newUser.user.id,
          permission_name: p,
          granted: true,
          granted_by: callerUser.id,
        });
      }
    }

    // Activation token
    const token = generateUrlToken(32);
    const tokenHash = await sha256Hex(token);
    await admin.from('account_activations').insert({
      user_id: newUser.user.id,
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + ACTIVATION_TTL_HOURS * 3_600_000).toISOString(),
      created_by: callerUser.id,
    });

    // Get caller display name for email
    const { data: callerProfile } = await admin.from('profiles').select('first_name, last_name').eq('id', callerUser.id).maybeSingle();
    const callerName = [callerProfile?.first_name, callerProfile?.last_name].filter(Boolean).join(' ') || null;

    const link = `${ACTIVATION_BASE_URL}?token=${encodeURIComponent(token)}`;
    const emailRes = await sendActivationEmail(email, link, callerName);
    if (!emailRes.success) {
      structuredLog('error', fn, cid, 'activation email failed', { error: emailRes.error });
      // Don't fail user creation; admin can resend.
    }

    await admin.rpc('log_auth_event', {
      _user_id: newUser.user.id, _event_type: 'activation_link_sent',
      _ip: ctx.ip, _user_agent: ctx.userAgent, _browser: ctx.browser, _os: ctx.os, _device: ctx.device,
      _metadata: { correlationId: cid, createdBy: callerUser.id },
    });

    return jsonResponse({ success: true, userId: newUser.user.id, email });
  } catch (e) {
    structuredLog('error', fn, cid, 'unhandled', { error: String(e) });
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});
