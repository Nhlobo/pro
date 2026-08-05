import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AdminCaseMessage {
  id: string;
  sender_type: 'admin' | 'external_user';
  body: string;
  created_at: string;
  read_by_admin_at: string | null;
}

export function useAdminCaseMessages(accountId: string | null, appointmentId: string | null) {
  return useQuery({
    queryKey: ['external-portal', 'admin-messages', accountId, appointmentId],
    queryFn: async (): Promise<AdminCaseMessage[]> => {
      const { data, error } = await supabase
        .from('external_portal_case_messages' as any)
        .select('id, sender_type, body, created_at, read_by_admin_at')
        .eq('account_id', accountId)
        .eq('appointment_id', appointmentId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Mark external-user messages as read by admin now that they've been fetched.
      await supabase
        .from('external_portal_case_messages' as any)
        .update({ read_by_admin_at: new Date().toISOString() })
        .eq('account_id', accountId)
        .eq('appointment_id', appointmentId)
        .eq('sender_type', 'external_user')
        .is('read_by_admin_at', null);

      return (data || []) as unknown as AdminCaseMessage[];
    },
    enabled: !!accountId && !!appointmentId,
    staleTime: 10_000,
  });
}

export function useSendAdminCaseMessage(accountId: string | null, appointmentId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: string) => {
      if (!accountId || !appointmentId) throw new Error('Missing account or case');
      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase.from('external_portal_case_messages' as any).insert({
        account_id: accountId,
        appointment_id: appointmentId,
        sender_type: 'admin',
        sender_staff_id: userData?.user?.id || null,
        body,
        read_by_admin_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-portal', 'admin-messages', accountId, appointmentId] });
    },
    onError: (error: any) => toast.error(error?.message || 'Could not send message'),
  });
}
