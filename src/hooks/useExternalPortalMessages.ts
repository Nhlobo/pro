import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMyExternalPortalAccountId } from './useMyExternalPortalAccountId';
import { toast } from 'sonner';

/**
 * External Portal Module — Messages (portal side).
 *
 * Scope is deliberately narrower than "every case this attorney/expert
 * can see": only appointments an admin has explicitly opened messaging
 * on via external_portal_case_links (revoked_at IS NULL). RLS (Phase 11
 * migration) enforces this same boundary server-side regardless of
 * what this code filters by — the explicit account_id checks below are
 * defense-in-depth, not the actual security boundary.
 */

export interface ExternalPortalMessageThread {
  appointment_id: string;
  claimant_name: string;
  claimant_auto_id: string | null;
  appointment_date: string | null;
  case_status: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
}

export interface ExternalPortalCaseMessage {
  id: string;
  account_id: string;
  appointment_id: string;
  sender_type: 'admin' | 'external_user';
  sender_staff_id: string | null;
  body: string;
  read_by_admin_at: string | null;
  read_by_external_at: string | null;
  created_at: string;
}

export function useExternalPortalMessageThreads() {
  const { data: accountId } = useMyExternalPortalAccountId();

  return useQuery({
    queryKey: ['external-portal', 'message-threads', accountId],
    queryFn: async (): Promise<ExternalPortalMessageThread[]> => {
      if (!accountId) return [];

      const { data: links, error: linksError } = await supabase
        .from('external_portal_case_links' as any)
        .select('appointment_id')
        .eq('account_id', accountId)
        .is('revoked_at', null);
      if (linksError) throw linksError;

      const appointmentIds = ((links || []) as { appointment_id: string }[]).map((l) => l.appointment_id);
      if (appointmentIds.length === 0) return [];

      const [{ data: appointments, error: apptError }, { data: messages, error: msgError }] = await Promise.all([
        supabase
          .from('appointments')
          .select('id, appointment_date, case_status, claimants(first_name, last_name, auto_id)')
          .in('id', appointmentIds),
        supabase
          .from('external_portal_case_messages' as any)
          .select('appointment_id, body, sender_type, read_by_external_at, created_at')
          .eq('account_id', accountId)
          .in('appointment_id', appointmentIds)
          .order('created_at', { ascending: false }),
      ]);
      if (apptError) throw apptError;
      if (msgError) throw msgError;

      const byAppointment = new Map<string, ExternalPortalMessageThread>();
      for (const appt of appointments || []) {
        const claimant = Array.isArray(appt.claimants) ? appt.claimants[0] : appt.claimants;
        byAppointment.set(appt.id, {
          appointment_id: appt.id,
          claimant_name: claimant ? `${claimant.first_name || ''} ${claimant.last_name || ''}`.trim() : 'Unknown claimant',
          claimant_auto_id: claimant?.auto_id || null,
          appointment_date: appt.appointment_date,
          case_status: appt.case_status,
          last_message_at: null,
          last_message_preview: null,
          unread_count: 0,
        });
      }

      for (const m of (messages || []) as any[]) {
        const thread = byAppointment.get(m.appointment_id);
        if (!thread) continue;
        if (!thread.last_message_at) {
          thread.last_message_at = m.created_at;
          thread.last_message_preview = m.body.length > 80 ? `${m.body.slice(0, 80)}…` : m.body;
        }
        if (m.sender_type === 'admin' && !m.read_by_external_at) {
          thread.unread_count += 1;
        }
      }

      return Array.from(byAppointment.values()).sort((a, b) => {
        if (!a.last_message_at && !b.last_message_at) return 0;
        if (!a.last_message_at) return 1;
        if (!b.last_message_at) return -1;
        return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
      });
    },
    enabled: !!accountId,
    staleTime: 15_000,
  });
}

export function useExternalPortalCaseMessages(appointmentId: string | null) {
  const { data: accountId } = useMyExternalPortalAccountId();
  const queryClient = useQueryClient();
  const queryKey = ['external-portal', 'case-messages', accountId, appointmentId];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<ExternalPortalCaseMessage[]> => {
      if (!accountId || !appointmentId) return [];
      const { data, error } = await supabase
        .from('external_portal_case_messages' as any)
        .select('*')
        .eq('account_id', accountId)
        .eq('appointment_id', appointmentId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ExternalPortalCaseMessage[];
    },
    enabled: !!accountId && !!appointmentId,
    staleTime: 5_000,
  });

  const sendMessage = useMutation({
    mutationFn: async (body: string) => {
      if (!accountId || !appointmentId) throw new Error('No case selected');
      const trimmed = body.trim();
      if (!trimmed) throw new Error('Message cannot be empty');
      const { error } = await supabase.from('external_portal_case_messages' as any).insert({
        account_id: accountId,
        appointment_id: appointmentId,
        sender_type: 'external_user',
        body: trimmed,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['external-portal', 'message-threads'] });
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to send message'),
  });

  const markThreadRead = useMutation({
    mutationFn: async () => {
      if (!accountId || !appointmentId) return;
      const { error } = await supabase
        .from('external_portal_case_messages' as any)
        .update({ read_by_external_at: new Date().toISOString() })
        .eq('account_id', accountId)
        .eq('appointment_id', appointmentId)
        .eq('sender_type', 'admin')
        .is('read_by_external_at', null);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['external-portal', 'message-threads'] });
      queryClient.invalidateQueries({ queryKey: ['external-portal', 'unread-count'] });
    },
  });

  return { ...query, sendMessage, markThreadRead };
}

export function useExternalPortalUnreadCount() {
  const { data: accountId } = useMyExternalPortalAccountId();

  return useQuery({
    queryKey: ['external-portal', 'unread-count', accountId],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('external_portal_unread_message_count' as any);
      if (error) throw error;
      return Number(data) || 0;
    },
    enabled: !!accountId,
    staleTime: 30_000,
  });
}
