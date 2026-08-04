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
      const { error } = await supabase.rpc('external_portal_revoke_session' as any, {
        _session_id: sessionId,
        _reason: 'Revoked by admin',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Session revoked');
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to revoke session'),
  });
}
