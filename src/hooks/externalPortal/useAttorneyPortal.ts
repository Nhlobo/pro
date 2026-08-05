import { useQuery } from '@tanstack/react-query';
import { useExternalPortalSession } from '@/hooks/externalPortal/useExternalPortalSession';
import { listAttorneyCases, getAttorneyCase, type ApiError } from '@/services/externalPortal/externalPortalAttorneyClient';

/**
 * Referring Attorney Portal hooks.
 *
 * Both hooks are no-ops (disabled query) until a session exists, and
 * automatically log the user out if the edge function reports the
 * session is no longer valid — e.g. it was revoked by an admin, or the
 * account was paused/expired since the last request.
 */

export function useAttorneyCases() {
  const { session, clearSession } = useExternalPortalSession();

  return useQuery({
    queryKey: ['external-portal', 'attorney', 'cases', session?.session_token],
    queryFn: async () => {
      try {
        return await listAttorneyCases(session!.session_token);
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

export function useAttorneyCase(appointmentId: string | undefined) {
  const { session, clearSession } = useExternalPortalSession();

  return useQuery({
    queryKey: ['external-portal', 'attorney', 'case', appointmentId, session?.session_token],
    queryFn: async () => {
      try {
        return await getAttorneyCase(session!.session_token, appointmentId!);
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
