import { useQuery } from '@tanstack/react-query';
import { useExternalPortalSession } from '@/hooks/externalPortal/useExternalPortalSession';
import { listAttorneyProgress } from '@/services/externalPortal/externalPortalAttorneyClient';
import { listExpertProgress } from '@/services/externalPortal/externalPortalExpertClient';
import type { ApiError } from '@/services/externalPortal/externalPortalAttorneyClient';

export function useCaseProgress(appointmentId: string | undefined) {
  const { session, clearSession } = useExternalPortalSession();

  return useQuery({
    queryKey: ['external-portal', 'progress', appointmentId, session?.session_token],
    queryFn: async () => {
      try {
        return session!.portal_type === 'attorney'
          ? await listAttorneyProgress(session!.session_token, appointmentId!)
          : await listExpertProgress(session!.session_token, appointmentId!);
      } catch (err) {
        const apiErr = err as ApiError;
        if (apiErr.code === 'SESSION_INVALID' || apiErr.code === 'ACCOUNT_NOT_ACTIVE') await clearSession();
        throw err;
      }
    },
    enabled: !!session && !!appointmentId,
    staleTime: 30_000,
  });
}
