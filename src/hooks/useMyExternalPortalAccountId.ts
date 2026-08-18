import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * External Portal Module — resolves the external_portal_accounts.id for
 * whichever attorney/expert is currently signed in via the bridged
 * portal session (see external-portal-auth's bridgeToSupabaseAuth).
 *
 * Backed by get_current_user_external_portal_account_id() (Phase 11
 * migration), which joins through profiles.referring_attorney_id /
 * profiles.expert_id — the same identity resolution every other piece
 * of this module already relies on. Returns null for staff sessions.
 *
 * Cached for the lifetime of the session (an account's id never
 * changes) so Messages/Profile pages share one lookup instead of each
 * re-resolving it.
 */
export function useMyExternalPortalAccountId() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['external-portal', 'my-account-id', user?.id],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.rpc('get_current_user_external_portal_account_id' as any);
      if (error) throw error;
      return (data as string) || null;
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
