import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useExternalPortalSession } from './useExternalPortalSession';
import {
  listPortalDocuments,
  getPortalDocumentUrl,
  getPortalCaseProgress,
  listPortalNotifications,
} from '@/services/externalPortal/externalPortalEngagementClient';

/**
 * Phase 5 hooks — shared by the Referring Attorney and Medical Expert
 * portals. All reads are scoped server-side by the session token; the
 * hooks simply pass it along.
 */

export function usePortalDocuments(appointmentId?: string) {
  const { session } = useExternalPortalSession();

  return useQuery({
    queryKey: ['external-portal', 'documents', appointmentId ?? 'all'],
    enabled: !!session?.session_token,
    staleTime: 30_000,
    queryFn: () => listPortalDocuments(session!.session_token, appointmentId),
  });
}

export function usePortalCaseProgress(appointmentId?: string) {
  const { session } = useExternalPortalSession();

  return useQuery({
    queryKey: ['external-portal', 'case-progress', appointmentId],
    enabled: !!session?.session_token && !!appointmentId,
    staleTime: 30_000,
    queryFn: () => getPortalCaseProgress(session!.session_token, appointmentId!),
  });
}

export function usePortalDocumentDownload() {
  const { session } = useExternalPortalSession();

  return useCallback(
    async (documentId: string) => {
      if (!session?.session_token) return;
      try {
        const { url } = await getPortalDocumentUrl(session.session_token, documentId);
        window.open(url, '_blank', 'noopener,noreferrer');
      } catch (err: any) {
        toast.error(err?.message || 'Could not open this document.');
      }
    },
    [session?.session_token],
  );
}

/**
 * Derived notification feed. There is no external notifications table
 * (external users have no auth.users row and this module never writes
 * case data), so "read" state is tracked locally per account — the feed
 * itself is always recomputed from live case data server-side.
 */
const READ_KEY_PREFIX = 'external_portal_read_notifications:';

function readIds(email: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_KEY_PREFIX + email) || '[]'));
  } catch {
    return new Set();
  }
}

export function usePortalNotifications() {
  const { session } = useExternalPortalSession();

  const query = useQuery({
    queryKey: ['external-portal', 'notifications', session?.email],
    enabled: !!session?.session_token,
    staleTime: 60_000,
    refetchInterval: 120_000,
    queryFn: () => listPortalNotifications(session!.session_token),
  });

  const email = session?.email || '';
  const notifications = query.data?.notifications ?? [];

  const withReadState = useMemo(() => {
    const read = readIds(email);
    return notifications.map((n) => ({ ...n, is_read: read.has(n.id) }));
  }, [notifications, email]);

  const unreadCount = withReadState.filter((n) => !n.is_read).length;

  const markAllRead = useCallback(() => {
    if (!email) return;
    const ids = notifications.map((n) => n.id);
    localStorage.setItem(READ_KEY_PREFIX + email, JSON.stringify(ids));
    query.refetch();
  }, [email, notifications, query]);

  return { ...query, notifications: withReadState, unreadCount, markAllRead };
}
