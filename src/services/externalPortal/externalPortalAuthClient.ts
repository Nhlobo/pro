import { supabase } from '@/integrations/supabase/client';
import type { ExternalPortalType } from '@/types/externalPortal';

/**
 * External Portal Module — auth client.
 *
 * Talks only to `external-portal-auth` (public) and, for admin
 * screens, `external-portal-admin-links` (staff-JWT required — that
 * one is called directly via supabase.functions.invoke from the admin
 * pages instead of through this file, since it runs under the normal
 * staff session rather than this module's own session handling).
 *
 * supabase-js does not parse the JSON body of a non-2xx Edge Function
 * response into `data` — it has to be read off `error.context`. Every
 * call here goes through `invoke()` so that extraction happens once.
 */

interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

async function invoke<T>(action: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('external-portal-auth', {
    body: { action, ...body },
  });

  if (error) {
    const apiError: ApiError = { message: error.message || 'Request failed' };
    // supabase-js v2: non-2xx responses land here with the raw Response on error.context
    const ctx = (error as any)?.context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const parsed = await ctx.json();
        if (parsed?.error) apiError.message = parsed.error;
        if (parsed?.code) apiError.code = parsed.code;
      } catch {
        /* body wasn't JSON — keep the generic message */
      }
    }
    throw apiError;
  }

  if (data && data.success === false) {
    throw { message: data.error || 'Request failed', code: data.code } as ApiError;
  }

  return (data?.data ?? data) as T;
}

export interface ConsumeLinkResult {
  portal_type: ExternalPortalType;
  masked_email: string;
  otp_expiry_minutes: number;
}

export function consumeAccessLink(token: string): Promise<ConsumeLinkResult> {
  return invoke('consume_link', { token });
}

export function requestRegistrationOtp(linkToken: string): Promise<{ masked_email: string }> {
  return invoke('request_otp', { mode: 'registration', link_token: linkToken });
}

export function requestLoginOtp(email: string, portalType: ExternalPortalType): Promise<{ message: string }> {
  return invoke('request_otp', { mode: 'login', email, portal_type: portalType });
}

export interface VerifyOtpResult {
  session_token: string;
  expires_at: string;
  portal_type: ExternalPortalType;
  account: { full_name: string; email: string };
}

export function verifyRegistrationOtp(linkToken: string, code: string): Promise<VerifyOtpResult> {
  return invoke('verify_otp', { mode: 'registration', link_token: linkToken, code });
}

export function verifyLoginOtp(email: string, portalType: ExternalPortalType, code: string): Promise<VerifyOtpResult> {
  return invoke('verify_otp', { mode: 'login', email, portal_type: portalType, code });
}

export function logoutExternalPortalSession(sessionToken: string): Promise<void> {
  return invoke('logout', { session_token: sessionToken });
}

export type { ApiError };
