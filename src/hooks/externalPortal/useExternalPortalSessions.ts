import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ExternalPortalSession } from '@/types/externalPortal';

const QUERY_KEY = ['external-portal', 'sessions'] as const;

export interface ExternalPortalSessionRow extends ExternalPortalSession {
  account_full_name: string;
  account_email: string;
  account_portal_type: string;
}

export function useExternalPortalSessions(activeOnly = true) {
  return useQuery({
    queryKey: [...QUERY_KEY, activeOnly],
    queryFn: async (): Promise<ExternalPortalSessionRow[]> => {
      let query = supabase
        .from('external_portal_sessions' as any)
        .select('*, account:account_id(full_name, email, portal_type)')
        .order('last_seen_at', { ascending: false })
        .limit(200);

      if (activeOnly) {
        query = query.is('revoked_at', null).gt('expires_at', new Date().toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      return ((data || []) as any[]).map((row) => ({
        ...row,
        account_full_name: row.account?.full_name || '—',
        account_email: row.account?.email || '—',
        account_portal_type: row.account?.portal_type || '—',
      }));
    },
    staleTime: 15_000,
  });
}

export function useRevokeExternalPortalSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      // Goes through external-portal-admin-links (staff-JWT verified)
      // rather than a direct RPC, because revoking now also has to
      // sign the person's real bridged Supabase session out — not
      // just mark this tracking row revoked, or they'd stay logged
      // into /attorney-portal or /expert-portal regardless.
      const { data, error } = await supabase.functions.invoke('external-portal-admin-links', {
        body: { action: 'revoke_session', session_id: sessionId },
      });
      if (error) throw error;
      if (data && data.success === false) throw new Error(data.error || 'Failed to revoke session');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Session revoked — they have been signed out');
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to revoke session'),
  });
}
