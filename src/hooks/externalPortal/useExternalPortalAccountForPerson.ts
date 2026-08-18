import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ExternalPortalAccount, ExternalPortalType } from '@/types/externalPortal';

/**
 * External Portal Module — resolves the (at most one) portal account
 * tied to a given referring_attorney / medical_expert record.
 *
 * This is what makes "choose a person from the usage-ranked list" safe
 * against duplicates (requirement 9): a person is looked up by their
 * referring_attorney_id / medical_expert_id, never re-created blindly.
 * Soft-deleted accounts are excluded here on purpose — if one exists
 * only in the Recycle Bin, the admin needs to explicitly restore it
 * from the Portal Accounts page rather than have a second active
 * account silently spring up underneath it.
 */

export function useExternalPortalAccountForPerson(
  portalType: ExternalPortalType,
  personId: string | null
) {
  return useQuery({
    queryKey: ['external-portal', 'account-for-person', portalType, personId],
    queryFn: async (): Promise<ExternalPortalAccount | null> => {
      if (!personId) return null;
      const column = portalType === 'attorney' ? 'referring_attorney_id' : 'medical_expert_id';
      const { data, error } = await supabase
        .from('external_portal_accounts' as any)
        .select('*')
        .eq('portal_type', portalType)
        .eq(column, personId)
        .is('deleted_at', null)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as ExternalPortalAccount) || null;
    },
    enabled: !!personId,
    staleTime: 15_000,
  });
}

export interface CreateAccountForPersonInput {
  portal_type: ExternalPortalType;
  person_id: string;
  full_name: string;
  email: string;
}

/** Creates a portal account tied to a specific attorney/expert record. Only call this after useExternalPortalAccountForPerson confirms none exists — this hook doesn't re-check. */
export function useCreateExternalPortalAccountForPerson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateAccountForPersonInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const isAttorney = input.portal_type === 'attorney';

      const { data, error } = await supabase
        .from('external_portal_accounts' as any)
        .insert({
          portal_type: input.portal_type,
          full_name: input.full_name.trim(),
          email: input.email.trim().toLowerCase(),
          referring_attorney_id: isAttorney ? input.person_id : null,
          medical_expert_id: isAttorney ? null : input.person_id,
          created_by: userData?.user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;
      const account = data as unknown as ExternalPortalAccount;

      await supabase.rpc('external_portal_log_audit' as any, {
        _actor_type: 'admin',
        _actor_id: userData?.user?.id || null,
        _account_id: account.id,
        _action: 'account_created',
        _details: { portal_type: input.portal_type, email: account.email, source: 'access_links_person_picker' },
      });

      return account;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-portal', 'accounts'] });
      queryClient.invalidateQueries({ queryKey: ['external-portal', 'account-for-person'] });
    },
    onError: (error: any) => {
      const msg = error?.message?.includes('external_portal_accounts_email_active_uq')
        ? 'An active account with this email already exists for this portal type.'
        : error?.message || 'Failed to create portal account';
      toast.error(msg);
    },
  });
}
