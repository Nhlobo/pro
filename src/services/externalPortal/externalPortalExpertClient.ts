import { supabase } from '@/integrations/supabase/client';

/**
 * Medical Expert Portal — data client. Same pattern as
 * externalPortalAttorneyClient.ts, talking to
 * external-portal-expert-data instead.
 */

interface ApiError {
  message: string;
  code?: string;
}

async function invoke<T>(action: string, sessionToken: string, extra: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('external-portal-expert-data', {
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

export interface ExpertCaseSummary {
  appointment_id: string;
  appointment_date: string;
  case_status: string | null;
  matter_type: string | null;
  payment_status: string | null;
  claimant: { first_name: string; last_name: string; reference: string } | null;
  referring_attorney: { name: string; code: string } | null;
  report: { report_status: string; report_due_date: string | null; report_submitted_date: string | null } | null;
}

export function listExpertCases(sessionToken: string): Promise<{ cases: ExpertCaseSummary[]; account: { full_name: string; email: string } }> {
  return invoke('list_cases', sessionToken);
}

export interface ExpertCaseDetail extends Omit<ExpertCaseSummary, 'claimant' | 'referring_attorney'> {
  assessment_code: string | null;
  claimant: { first_name: string; last_name: string; auto_id: string; contact_number: string | null } | null;
  referring_attorney: { name: string; code: string; contact_person: string | null; phone: string | null; email: string | null } | null;
}

export function getExpertCase(sessionToken: string, appointmentId: string): Promise<{ case: ExpertCaseDetail }> {
  return invoke('get_case', sessionToken, { appointment_id: appointmentId });
}

export interface PortalDocument {
  id: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  document_type: string;
  upload_date: string;
}

export function listExpertDocuments(sessionToken: string, appointmentId: string): Promise<{ documents: PortalDocument[] }> {
  return invoke('list_documents', sessionToken, { appointment_id: appointmentId });
}

export function getExpertDocumentUrl(sessionToken: string, documentId: string): Promise<{ url: string; file_name: string }> {
  return invoke('get_document_url', sessionToken, { document_id: documentId });
}

export interface PortalCasePhase {
  phase_name: string;
  phase_order: number;
  status: string;
  started_at: string | null;
  completed_at: string | null;
}

export function listExpertProgress(sessionToken: string, appointmentId: string): Promise<{ phases: PortalCasePhase[] }> {
  return invoke('list_progress', sessionToken, { appointment_id: appointmentId });
}

export type { ApiError };
