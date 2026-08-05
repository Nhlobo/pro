import { supabase } from '@/integrations/supabase/client';

/**
 * Referring Attorney Portal — data client.
 *
 * Talks only to `external-portal-attorney-data`. Every call sends the
 * module's own session token (never the app's Supabase auth token —
 * external users don't have one) and the edge function validates it
 * against external_portal_sessions itself.
 */

interface ApiError {
  message: string;
  code?: string;
}

async function invoke<T>(action: string, sessionToken: string, extra: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('external-portal-attorney-data', {
    body: { action, session_token: sessionToken, ...extra },
  });

  if (error) {
    const apiError: ApiError = { message: error.message || 'Request failed' };
    const ctx = (error as any)?.context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const parsed = await ctx.json();
        if (parsed?.error) apiError.message = parsed.error;
        if (parsed?.code) apiError.code = parsed.code;
      } catch {
        /* body wasn't JSON */
      }
    }
    throw apiError;
  }

  if (data && data.success === false) {
    throw { message: data.error || 'Request failed', code: data.code } as ApiError;
  }

  return (data?.data ?? data) as T;
}

export interface AttorneyCaseSummary {
  appointment_id: string;
  appointment_date: string;
  case_status: string | null;
  matter_type: string | null;
  payment_status: string | null;
  claimant: { first_name: string; last_name: string; reference: string } | null;
  expert: { first_name: string; last_name: string; expert_type: string; province: string | null } | null;
  report: { report_status: string; report_due_date: string | null; report_submitted_date: string | null } | null;
}

export function listAttorneyCases(sessionToken: string): Promise<{ cases: AttorneyCaseSummary[]; account: { full_name: string; email: string } }> {
  return invoke('list_cases', sessionToken);
}

export interface AttorneyCaseDetail extends Omit<AttorneyCaseSummary, 'claimant' | 'expert'> {
  service_fee: number | null;
  deposit_amount: number | null;
  agreement_duration_months: number | null;
  assessment_code: string | null;
  claimant: { first_name: string; last_name: string; auto_id: string; contact_number: string | null } | null;
  expert: { first_name: string; last_name: string; expert_type: string; province: string | null; city: string | null } | null;
}

export function getAttorneyCase(sessionToken: string, appointmentId: string): Promise<{ case: AttorneyCaseDetail }> {
  return invoke('get_case', sessionToken, { appointment_id: appointmentId });
}

export type { ApiError };
