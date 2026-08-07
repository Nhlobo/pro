import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Legacy (old) portal users.
 *
 * The old Attorney / Expert portals sign users in with a normal Supabase auth
 * session — those people live in `profiles`, NOT in `external_portal_accounts`.
 * The External Portal Management page previously only listed the new module's
 * accounts, so these users were invisible there. This read-only-plus-status
 * hook surfaces them so admins can see and manage access from the same page.
 *
 * No backend change: it reuses the existing `profiles` table and the existing
 * `deactivate-user` edge function used by Access & IAM.
 */

export interface LegacyPortalUser {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  user_type: string | null;
  role: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  referring_attorney_id: string | null;
  expert_id: string | null;
  portal: 'attorney' | 'expert';
}

const QUERY_KEY = ['external-portal', 'legacy-portal-users'] as const;

export function useLegacyPortalUsers() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<LegacyPortalUser[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, email, first_name, last_name, user_type, role, is_active, last_login_at, created_at, referring_attorney_id, expert_id'
        )
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || [])
        .filter(
          (p: any) =>
            p.user_type === 'referring_attorney' ||
            p.user_type === 'medical_expert' ||
            p.user_type === 'expert' ||
            !!p.referring_attorney_id ||
            !!p.expert_id
        )
        .map((p: any) => ({
          ...p,
          portal:
            p.user_type === 'medical_expert' || p.user_type === 'expert' || (!!p.expert_id && !p.referring_attorney_id)
              ? 'expert'
              : 'attorney',
        })) as LegacyPortalUser[];
    },
    staleTime: 30_000,
  });
}

export function useSetLegacyPortalUserActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, active, reason }: { userId: string; active: boolean; reason?: string }) => {
      const { data, error } = await supabase.functions.invoke('deactivate-user', {
        body: active ? { userId, active: true } : { userId, active: false, reason: reason || 'Portal access revoked' },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success(vars.active ? 'Portal user reactivated' : 'Portal user deactivated');
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to update portal user'),
  });
}
