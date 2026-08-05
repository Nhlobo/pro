import { supabase } from '@/integrations/supabase/client';

interface ApiError {
  message: string;
  code?: string;
}

async function invoke<T>(action: string, sessionToken: string, appointmentId: string, extra: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('external-portal-messages', {
    body: { action, session_token: sessionToken, appointment_id: appointmentId, ...extra },
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

export interface PortalMessage {
  id: string;
  sender_type: 'admin' | 'external_user';
  body: string;
  created_at: string;
}

export function listCaseMessages(sessionToken: string, appointmentId: string): Promise<{ messages: PortalMessage[] }> {
  return invoke('list', sessionToken, appointmentId);
}

export function sendCaseMessage(sessionToken: string, appointmentId: string, body: string): Promise<{ message: PortalMessage }> {
  return invoke('send', sessionToken, appointmentId, { body });
}

export type { ApiError };
