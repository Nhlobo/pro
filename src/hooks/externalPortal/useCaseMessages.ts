import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useExternalPortalSession } from '@/hooks/externalPortal/useExternalPortalSession';
import { listCaseMessages, sendCaseMessage } from '@/services/externalPortal/externalPortalMessagesClient';
import type { ApiError } from '@/services/externalPortal/externalPortalMessagesClient';

export function useCaseMessages(appointmentId: string | undefined) {
  const { session, clearSession } = useExternalPortalSession();

  return useQuery({
    queryKey: ['external-portal', 'messages', appointmentId, session?.session_token],
    queryFn: async () => {
      try {
        return await listCaseMessages(session!.session_token, appointmentId!);
      } catch (err) {
        const apiErr = err as ApiError;
        if (apiErr.code === 'SESSION_INVALID' || apiErr.code === 'ACCOUNT_NOT_ACTIVE') await clearSession();
        throw err;
      }
    },
    enabled: !!session && !!appointmentId,
    staleTime: 10_000,
  });
}

export function useSendCaseMessage(appointmentId: string | undefined) {
  const { session } = useExternalPortalSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: string) => {
      if (!session || !appointmentId) throw new Error('Not signed in');
      return sendCaseMessage(session.session_token, appointmentId, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-portal', 'messages', appointmentId, session?.session_token] });
    },
    onError: (error: any) => toast.error(error?.message || 'Could not send message'),
  });
}
