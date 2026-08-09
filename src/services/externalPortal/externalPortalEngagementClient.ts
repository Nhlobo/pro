// External Portal Module — engagement client.
//
// Thin wrapper around the `external-portal-engagement` edge function
// (see supabase/functions/external-portal-engagement/index.ts), which
// is shared by both portal types: it derives the right visibility
// column (attorney vs expert) from the session's account server-side,
// so this client never needs to know which portal type is calling it.
import { supabase } from '@/integrations/supabase/client';
import type { ApiError } from './externalPortalAuthClient';

export type { ApiError };

export interface PortalDocument {
  id: string;
  appointment_id: string;
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
  status: 'completed' | 'in_progress' | 'pending';
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
}

export interface PortalNotification {
  id: string;
  category: string;
  title: string;
  message: string;
  appointment_id: string;
  occurred_at: string;
}

async function invokeEngagement<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('external-portal-engagement', { body });

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

export function listPortalDocuments(sessionToken: string, appointmentId?: string): Promise<{ documents: PortalDocument[] }> {
  return invokeEngagement({ action: 'list_documents', session_token: sessionToken, appointment_id: appointmentId });
}

export function getPortalDocumentUrl(sessionToken: string, documentId: string): Promise<{ url: string; file_name: string }> {
  return invokeEngagement({ action: 'get_document_url', session_token: sessionToken, document_id: documentId });
}

export function getPortalCaseProgress(sessionToken: string, appointmentId: string): Promise<{ phases: PortalCasePhase[] }> {
  return invokeEngagement({ action: 'get_case_progress', session_token: sessionToken, appointment_id: appointmentId });
}

export function listPortalNotifications(sessionToken: string): Promise<{ notifications: PortalNotification[] }> {
  return invokeEngagement({ action: 'list_notifications', session_token: sessionToken });
}
