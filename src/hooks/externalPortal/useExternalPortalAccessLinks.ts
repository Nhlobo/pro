import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ExternalPortalAccessLink } from '@/types/externalPortal';

const QUERY_KEY = ['external-portal', 'links'] as const;

export interface ExternalPortalAccessLinkRow extends ExternalPortalAccessLink {
  account_full_name: string;
  account_email: string;
  account_portal_type: string;
}

export function useExternalPortalAccessLinks() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<ExternalPortalAccessLinkRow[]> => {
      const { data, error } = await supabase
        .from('external_portal_access_links' as any)
        .select('*, account:account_id(full_name, email, portal_type)')
        .order('created_at', { ascending: false })
        .limit(200);
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

export function useGenerateExternalPortalLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (accountId: string) => {
      const { data, error } = await supabase.functions.invoke('external-portal-admin-links', {
        body: { action: 'generate_link', account_id: accountId, send_email: true },
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
      return data.data as { link_id: string; link_url: string; expires_at: string; email_sent: boolean };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success(result.email_sent ? 'Access link generated and emailed' : 'Access link generated (email not sent — copy it manually)');
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to generate access link'),
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
      toast.success('Access link revoked');
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to revoke access link'),
  });
}
