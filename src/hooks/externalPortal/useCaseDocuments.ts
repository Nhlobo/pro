import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useExternalPortalSession } from '@/hooks/externalPortal/useExternalPortalSession';
import { listAttorneyDocuments, getAttorneyDocumentUrl } from '@/services/externalPortal/externalPortalAttorneyClient';
import { listExpertDocuments, getExpertDocumentUrl } from '@/services/externalPortal/externalPortalExpertClient';
import type { ApiError } from '@/services/externalPortal/externalPortalAttorneyClient';

/**
 * Same shape of data, same edge-function action names, on both
 * external-portal-attorney-data and external-portal-expert-data — this
 * hook just picks the right client for the signed-in portal type so
 * case-detail pages don't need to know which one they are.
 */
export function useCaseDocuments(appointmentId: string | undefined) {
  const { session, clearSession } = useExternalPortalSession();

  return useQuery({
    queryKey: ['external-portal', 'documents', appointmentId, session?.session_token],
    queryFn: async () => {
      try {
        return session!.portal_type === 'attorney'
          ? await listAttorneyDocuments(session!.session_token, appointmentId!)
          : await listExpertDocuments(session!.session_token, appointmentId!);
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

export function useDownloadCaseDocument() {
  const { session } = useExternalPortalSession();

  return useMutation({
    mutationFn: async (documentId: string) => {
      if (!session) throw new Error('Not signed in');
      const result =
        session.portal_type === 'attorney'
          ? await getAttorneyDocumentUrl(session.session_token, documentId)
          : await getExpertDocumentUrl(session.session_token, documentId);
      return result;
    },
    onSuccess: (result) => {
      window.open(result.url, '_blank', 'noopener,noreferrer');
    },
    onError: (error: any) => toast.error(error?.message || 'Could not open this document'),
  });
}
