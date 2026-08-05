import { useQuery } from '@tanstack/react-query';
import { useExternalPortalSession } from '@/hooks/externalPortal/useExternalPortalSession';
import { listExpertCases, getExpertCase, type ApiError } from '@/services/externalPortal/externalPortalExpertClient';

export function useExpertCases() {
  const { session, clearSession } = useExternalPortalSession();

  return useQuery({
    queryKey: ['external-portal', 'expert', 'cases', session?.session_token],
    queryFn: async () => {
      try {
        return await listExpertCases(session!.session_token);
      } catch (err) {
        const apiErr = err as ApiError;
        if (apiErr.code === 'SESSION_INVALID' || apiErr.code === 'ACCOUNT_NOT_ACTIVE') {
          await clearSession();
        }
        throw err;
      }
    },
    enabled: !!session,
    staleTime: 30_000,
  });
}

export function useExpertCase(appointmentId: string | undefined) {
  const { session, clearSession } = useExternalPortalSession();

  return useQuery({
    queryKey: ['external-portal', 'expert', 'case', appointmentId, session?.session_token],
    queryFn: async () => {
      try {
        return await getExpertCase(session!.session_token, appointmentId!);
      } catch (err) {
        const apiErr = err as ApiError;
        if (apiErr.code === 'SESSION_INVALID' || apiErr.code === 'ACCOUNT_NOT_ACTIVE') {
          await clearSession();
        }
        throw err;
      }
    },
    enabled: !!session && !!appointmentId,
    staleTime: 30_000,
  });
}
