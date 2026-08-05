import { supabase } from '@/integrations/supabase/client';

/**
 * External Portal Module — Phase 5 engagement client.
 *
 * Shared by BOTH portal types (attorney + expert): documents, case
 * progress and the derived notification feed all come from the single
 * `external-portal-engagement` edge function, which decides visibility
 * from the session's portal_type. Nothing here trusts the browser.
 */

interface ApiError {
  message: string;
  code?: string;
}

async function invoke<T>(action: string, sessionToken: string, extra: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('external-portal-engagement', {
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

export interface PortalDocument {
  id: string;
  appointment_id: string | null;
  document_type: string;
  file_name: string;
  file_size: number | null;
  file_type: string | null;
  upload_date: string;
  upload_time: string | null;
  approval_status: string | null;
  notes: string | null;
}

export interface PortalCasePhase {
  id: string;
  phase_name: string;
  phase_order: number;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
}

export interface PortalNotification {
  id: string;
  category: 'report' | 'document' | 'progress' | string;
  title: string;
  message: string;
  appointment_id: string;
  occurred_at: string;
}

export function listPortalDocuments(sessionToken: string, appointmentId?: string): Promise<{ documents: PortalDocument[] }> {
  return invoke('list_documents', sessionToken, appointmentId ? { appointment_id: appointmentId } : {});
}

export function getPortalDocumentUrl(sessionToken: string, documentId: string): Promise<{ url: string; file_name: string }> {
  return invoke('get_document_url', sessionToken, { document_id: documentId });
}

export function getPortalCaseProgress(sessionToken: string, appointmentId: string): Promise<{ phases: PortalCasePhase[] }> {
  return invoke('get_case_progress', sessionToken, { appointment_id: appointmentId });
}

export function listPortalNotifications(sessionToken: string): Promise<{ notifications: PortalNotification[] }> {
  return invoke('list_notifications', sessionToken);
}

export type { ApiError };
