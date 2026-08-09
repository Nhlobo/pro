// External Portal Module — Referring Attorney Portal client.
//
// list_cases / get_case wrap the `external-portal-attorney-data` edge
// function (see supabase/functions/external-portal-attorney-data/index.ts).
// Documents/progress are shared across both portal types by the
// `external-portal-engagement` function — re-exported here under
// attorney-specific names so callers don't need to know that.
import { supabase } from '@/integrations/supabase/client';
import type { ApiError } from './externalPortalAuthClient';
import { getPortalDocumentUrl, getPortalCaseProgress, listPortalDocuments } from './externalPortalEngagementClient';

export type { ApiError };

export interface AttorneyCaseParty {
  first_name: string;
  last_name: string;
  reference?: string;
  auto_id?: string;
  contact_number?: string;
  expert_type?: string;
  province?: string;
  city?: string;
}

export interface AttorneyCaseReport {
  report_status: string;
  report_due_date: string | null;
  report_submitted_date: string | null;
  payment_status?: string;
}

export interface AttorneyCaseSummary {
  appointment_id: string;
  appointment_date: string;
  case_status: string;
  matter_type: string;
  payment_status: string;
  claimant: AttorneyCaseParty | null;
  expert: AttorneyCaseParty | null;
  report: AttorneyCaseReport | null;
}

export interface AttorneyCaseDetail extends AttorneyCaseSummary {
  service_fee: number | null;
  deposit_amount: number | null;
  agreement_duration_months: number | null;
  assessment_code: string | null;
}

async function invokeAttorneyData<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('external-portal-attorney-data', { body });

  if (error) {
    const ctx = (error as any)?.context;
    if (ctx?.json) {
      const parsed = await ctx.json().catch(() => null);
      throw { message: parsed?.error || error.message, code: parsed?.code, status: ctx?.status } as ApiError;
    }
    throw { message: error.message } as ApiError;
  }

  if (data?.success === false) {
    throw { message: data.error || 'Something went wrong. Please try again.', code: data.code } as ApiError;
  }

  return data.data as T;
}

export function listAttorneyCases(sessionToken: string): Promise<{ cases: AttorneyCaseSummary[]; account: { full_name: string; email: string } }> {
  return invokeAttorneyData({ action: 'list_cases', session_token: sessionToken });
}

export function getAttorneyCase(sessionToken: string, appointmentId: string): Promise<{ case: AttorneyCaseDetail }> {
  return invokeAttorneyData({ action: 'get_case', session_token: sessionToken, appointment_id: appointmentId });
}

/** Documents/progress are portal-agnostic server-side — these just delegate to the shared engagement client. */
export function listAttorneyDocuments(sessionToken: string, appointmentId: string) {
  return listPortalDocuments(sessionToken, appointmentId);
}

export function getAttorneyDocumentUrl(sessionToken: string, documentId: string) {
  return getPortalDocumentUrl(sessionToken, documentId);
}

export function listAttorneyProgress(sessionToken: string, appointmentId: string) {
  return getPortalCaseProgress(sessionToken, appointmentId);
}
