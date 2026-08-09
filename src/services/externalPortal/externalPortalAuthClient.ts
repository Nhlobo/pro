// External Portal Module — auth client.
//
// Thin wrapper around the `external-portal-auth` edge function (see
// supabase/functions/external-portal-auth/index.ts). This function is
// public (verify_jwt = false) — external users are never Supabase
// auth.users, so there is no JWT for these calls. Every response is
// shaped `{ success: true, data }` or `{ success: false, error, code }`.
import { supabase } from '@/integrations/supabase/client';
import type { ExternalPortalType } from '@/types/externalPortal';

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

interface ConsumeAccessLinkResult {
  portal_type: ExternalPortalType;
  masked_email: string;
  otp_expiry_minutes: number;
}

interface RequestOtpResult {
  masked_email: string;
}

interface RequestLoginOtpResult {
  message: string;
}

interface VerifyOtpResult {
  session_token: string;
  expires_at: string;
  portal_type: ExternalPortalType;
  account: {
    full_name: string;
    email: string;
  };
}

async function invokeAuth<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('external-portal-auth', { body });

  if (error) {
    const ctx = (error as any)?.context;
    if (ctx?.json) {
      const parsed = await ctx.json().catch(() => null);
      const apiError: ApiError = {
        message: parsed?.error || error.message,
        code: parsed?.code,
        status: ctx?.status,
      };
      throw apiError;
    }
    throw { message: error.message } as ApiError;
  }

  if (data?.success === false) {
    throw { message: data.error || 'Something went wrong. Please try again.', code: data.code } as ApiError;
  }

  return data.data as T;
}

/** One-time registration link -> validates it and sends the first OTP. */
export function consumeAccessLink(token: string): Promise<ConsumeAccessLinkResult> {
  return invokeAuth<ConsumeAccessLinkResult>({ action: 'consume_link', token });
}

/** Resend an OTP for a pending registration link. */
export function requestRegistrationOtp(linkToken: string): Promise<RequestOtpResult> {
  return invokeAuth<RequestOtpResult>({ action: 'request_otp', mode: 'registration', link_token: linkToken });
}

/** Request an OTP for a returning user (email + portal type). Always returns a generic message. */
export function requestLoginOtp(email: string, portalType: ExternalPortalType): Promise<RequestLoginOtpResult> {
  return invokeAuth<RequestLoginOtpResult>({ action: 'request_otp', mode: 'login', email, portal_type: portalType });
}

/** Verify the OTP for a registration link -> issues a session. */
export function verifyRegistrationOtp(linkToken: string, code: string): Promise<VerifyOtpResult> {
  return invokeAuth<VerifyOtpResult>({ action: 'verify_otp', mode: 'registration', link_token: linkToken, code });
}

/** Verify the OTP for a returning user login -> issues a session. */
export function verifyLoginOtp(email: string, portalType: ExternalPortalType, code: string): Promise<VerifyOtpResult> {
  return invokeAuth<VerifyOtpResult>({ action: 'verify_otp', mode: 'login', email, portal_type: portalType, code });
}

/** Best-effort session revoke on sign-out. */
export function logoutExternalPortalSession(sessionToken: string): Promise<void> {
  return invokeAuth<void>({ action: 'logout', session_token: sessionToken });
}
