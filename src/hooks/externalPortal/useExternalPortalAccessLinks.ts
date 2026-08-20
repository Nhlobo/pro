import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ExternalPortalLinkStatus, ExternalPortalType } from '@/types/externalPortal';

/**
 * External Portal Module — admin-side access links list + generate/revoke.
 *
 * Generation and revocation are deliberately thin wrappers around the
 * `external-portal-admin-links` edge function (same one
 * useBulkGenerateExternalPortalLinks calls) — the admin-only check,
 * token hashing, email dispatch, and audit log all live server-side
 * there. This file's own job is just the list query used to render
 * the "Access Links" table, plus the two mutations wired to that
 * function.
 */

const QUERY_KEY = ['external-portal', 'links'] as const;

export interface ExternalPortalAccessLinkRow {
  id: string;
  account_id: string;
  status: ExternalPortalLinkStatus;
  expires_at: string;
  created_at: string;
  sent_to_email: string | null;
  account_full_name: string;
  account_portal_type: ExternalPortalType;
  account_email: string;
}

interface RawLinkRow {
  id: string;
  account_id: string;
  status: ExternalPortalLinkStatus;
  expires_at: string;
  created_at: string;
  sent_to_email: string | null;
  external_portal_accounts: {
    full_name: string;
    portal_type: ExternalPortalType;
    email: string;
  } | null;
}

async function fetchAccessLinks(): Promise<ExternalPortalAccessLinkRow[]> {
  const { data, error } = await supabase
    .from('external_portal_access_links' as any)
    .select('id, account_id, status, expires_at, created_at, sent_to_email, external_portal_accounts(full_name, portal_type, email)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw error;

  return ((data || []) as unknown as RawLinkRow[]).map((row) => ({
    id: row.id,
    account_id: row.account_id,
    status: row.status,
    expires_at: row.expires_at,
    created_at: row.created_at,
    sent_to_email: row.sent_to_email,
    account_full_name: row.external_portal_accounts?.full_name || 'Unknown',
    account_portal_type: row.external_portal_accounts?.portal_type || 'attorney',
    account_email: row.external_portal_accounts?.email || '',
  }));
}

export function useExternalPortalAccessLinks() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchAccessLinks,
    staleTime: 15_000,
  });
}

export interface GenerateLinkResult {
  link_id: string;
  link_url: string;
  expires_at: string;
  email_sent: boolean;
  sent_to_email: string;
}

export function useGenerateExternalPortalLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ accountId, email }: { accountId: string; email?: string }): Promise<GenerateLinkResult> => {
      const { data, error } = await supabase.functions.invoke('external-portal-admin-links', {
        body: { action: 'generate_link', account_id: accountId, send_email: true, email },
      });

      if (error) {
        const ctx = (error as any)?.context;
        if (ctx?.json) {
          const parsed = await ctx.json().catch(() => null);
          throw new Error(parsed?.error || error.message);
        }
        throw new Error(error.message);
      }
      if (data?.success === false) throw new Error(data.error || 'Failed to generate link');

      return data.data as GenerateLinkResult;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['external-portal', 'accounts'] });
      toast.success(data.email_sent ? 'Link generated and emailed' : 'Link generated — email not sent, check RESEND_API_KEY');
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to generate link'),
  });
}

export function useRevokeExternalPortalLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ linkId, reason }: { linkId: string; reason?: string }) => {
      const { data, error } = await supabase.functions.invoke('external-portal-admin-links', {
        body: { action: 'revoke_link', link_id: linkId, reason },
      });

      if (error) {
        const ctx = (error as any)?.context;
        if (ctx?.json) {
          const parsed = await ctx.json().catch(() => null);
          throw new Error(parsed?.error || error.message);
        }
        throw new Error(error.message);
      }
      if (data?.success === false) throw new Error(data.error || 'Failed to revoke link');

      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['external-portal', 'accounts'] });
      toast.success('Link revoked');
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to revoke link'),
  });
}
