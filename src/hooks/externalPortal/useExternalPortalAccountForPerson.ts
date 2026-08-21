import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ExternalPortalAccount, ExternalPortalAccountScope, ExternalPortalType } from '@/types/externalPortal';

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
  /** Phase 14: for attorney accounts scoped to 'individual', the referring_attorney_contacts row this account belongs to. Ignored (and stored as null) for 'firm'-scoped accounts, which see every case for the firm regardless of any one individual. */
  assigned_attorney_contact_id?: string | null;
  /** Phase 20: for attorney accounts, whether this account represents the whole firm or one individual at it. Required for attorney accounts; ignored for expert accounts (always null — experts are individually scoped via medical_expert_id already). */
  account_scope?: ExternalPortalAccountScope | null;
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
          account_scope: isAttorney ? (input.account_scope || null) : null,
          assigned_attorney_contact_id: isAttorney && input.account_scope === 'individual'
            ? (input.assigned_attorney_contact_id || null)
            : null,
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

/**
 * Phase 20: change an EXISTING account's scope (firm <-> individual)
 * without deleting/recreating it. Switching to 'firm' clears any
 * assigned contact (a firm-scoped account isn't limited to one
 * individual's cases); switching to 'individual' requires the caller
 * to separately set a contact via useUpdateExternalPortalAccountContact
 * — this mutation alone would otherwise leave an individual-scoped
 * account with no contact, which resolves to zero visible cases.
 */
export function useUpdateExternalPortalAccountScope() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { accountId: string; scope: ExternalPortalAccountScope }) => {
      const { error } = await supabase
        .from('external_portal_accounts' as any)
        .update({
          account_scope: input.scope,
          assigned_attorney_contact_id: input.scope === 'firm' ? null : undefined,
        })
        .eq('id', input.accountId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-portal', 'accounts'] });
      queryClient.invalidateQueries({ queryKey: ['external-portal', 'account-for-person'] });
      toast.success('Account scope updated');
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to update account scope');
    },
  });
}

/**
 * Phase 14: repair the individual-attorney relationship on an
 * EXISTING account without deleting/recreating it — the account keeps
 * working (its login, history, everything) throughout.
 */
export function useUpdateExternalPortalAccountContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { accountId: string; contactId: string | null }) => {
      const { error } = await supabase
        .from('external_portal_accounts' as any)
        .update({ assigned_attorney_contact_id: input.contactId })
        .eq('id', input.accountId);
      if (error) throw error;

      // The account's bridged profile (if it's ever logged in before)
      // is re-synced automatically on its NEXT login by
      // external-portal-auth. If it's currently mid-session, this
      // takes effect the next time it authenticates.
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-portal', 'accounts'] });
      queryClient.invalidateQueries({ queryKey: ['external-portal', 'account-for-person'] });
      toast.success('Individual attorney relationship updated');
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to update relationship');
    },
  });
}
