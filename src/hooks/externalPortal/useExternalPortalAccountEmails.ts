import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ExternalPortalAccountEmail } from '@/types/externalPortal';

/**
 * External Portal Module — per-account email history.
 *
 * Reads `external_portal_account_emails` (Phase 10 migration). Never
 * written to directly from the client — the admin-links Edge Function
 * owns writes (on generate_link, when the resolved send-to address
 * differs from the account's current email), so history always stays
 * consistent with what was actually sent and to whom.
 */

export function useExternalPortalAccountEmails(accountId: string | null) {
  return useQuery({
    queryKey: ['external-portal', 'account-emails', accountId],
    queryFn: async (): Promise<ExternalPortalAccountEmail[]> => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from('external_portal_account_emails' as any)
        .select('*')
        .eq('account_id', accountId)
        .order('is_current', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ExternalPortalAccountEmail[];
    },
    enabled: !!accountId,
    staleTime: 15_000,
  });
}
