// External Portal Module — case messages client.
//
// Wraps the `external-portal-messages` edge function (see
// supabase/functions/external-portal-messages/index.ts). Shared by
// both portal types — messaging works identically for either.
import { supabase } from '@/integrations/supabase/client';
import type { ApiError } from './externalPortalAuthClient';

export type { ApiError };

export interface CaseMessage {
  id: string;
  sender_type: 'external_user' | 'admin';
  body: string;
  created_at: string;
}

async function invokeMessages<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('external-portal-messages', { body });

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

export function listCaseMessages(sessionToken: string, appointmentId: string): Promise<{ messages: CaseMessage[] }> {
  return invokeMessages({ action: 'list', session_token: sessionToken, appointment_id: appointmentId });
}

export function sendCaseMessage(sessionToken: string, appointmentId: string, body: string): Promise<{ message: CaseMessage }> {
  return invokeMessages({ action: 'send', session_token: sessionToken, appointment_id: appointmentId, body });
}
