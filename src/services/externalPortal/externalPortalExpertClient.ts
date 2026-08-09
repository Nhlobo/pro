// External Portal Module — Medical Expert Portal client.
//
// list_cases / get_case wrap the `external-portal-expert-data` edge
// function (see supabase/functions/external-portal-expert-data/index.ts).
// Documents/progress are shared across both portal types by the
// `external-portal-engagement` function — re-exported here under
// expert-specific names so callers don't need to know that.
import { supabase } from '@/integrations/supabase/client';
import type { ApiError } from './externalPortalAuthClient';
import { getPortalDocumentUrl, getPortalCaseProgress, listPortalDocuments } from './externalPortalEngagementClient';

export type { ApiError };

export interface ExpertCaseClaimant {
  first_name: string;
  last_name: string;
  reference?: string;
  auto_id?: string;
  contact_number?: string;
}

export interface ExpertCaseAttorney {
  name: string;
  code?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
}

export interface ExpertCaseReport {
  report_status: string;
  report_due_date: string | null;
  report_submitted_date: string | null;
  payment_status?: string;
}

export interface ExpertCaseSummary {
  appointment_id: string;
  appointment_date: string;
  case_status: string;
  matter_type: string;
  payment_status: string;
  claimant: ExpertCaseClaimant | null;
  referring_attorney: ExpertCaseAttorney | null;
  report: ExpertCaseReport | null;
}

export interface ExpertCaseDetail extends ExpertCaseSummary {
  assessment_code: string | null;
}

async function invokeExpertData<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('external-portal-expert-data', { body });

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

export function listExpertCases(sessionToken: string): Promise<{ cases: ExpertCaseSummary[]; account: { full_name: string; email: string } }> {
  return invokeExpertData({ action: 'list_cases', session_token: sessionToken });
}

export function getExpertCase(sessionToken: string, appointmentId: string): Promise<{ case: ExpertCaseDetail }> {
  return invokeExpertData({ action: 'get_case', session_token: sessionToken, appointment_id: appointmentId });
}

/** Documents/progress are portal-agnostic server-side — these just delegate to the shared engagement client. */
export function listExpertDocuments(sessionToken: string, appointmentId: string) {
  return listPortalDocuments(sessionToken, appointmentId);
}

export function getExpertDocumentUrl(sessionToken: string, documentId: string) {
  return getPortalDocumentUrl(sessionToken, documentId);
}

export function listExpertProgress(sessionToken: string, appointmentId: string) {
  return getPortalCaseProgress(sessionToken, appointmentId);
}
