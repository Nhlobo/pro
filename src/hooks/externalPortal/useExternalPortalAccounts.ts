import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type {
  ExternalPortalAccount,
  ExternalPortalAccountWithMeta,
  ExternalPortalAccountStatus,
  ExternalPortalType,
} from '@/types/externalPortal';

/**
 * External Portal Module — admin account management.
 *
 * Phase 1 scope only: create/list/pause/resume/expire/soft-delete/
 * restore/permanently-delete accounts, and link them to existing
 * cases (appointments) for later display. No link-generation, OTP,
 * or session logic lives here — that's Phase 2.
 *
 * Every mutation that changes lifecycle state goes through the
 * `external_portal_set_account_status` / permanent-delete RPCs
 * defined in the Phase 1 migration, so the admin-only check and the
 * audit log write happen once, server-side, rather than being
 * re-implemented per call site here.
 */

const QUERY_KEY = ['external-portal', 'accounts'] as const;

export interface CreateExternalPortalAccountInput {
  portal_type: ExternalPortalType;
  full_name: string;
  email: string;
  phone?: string;
  referring_attorney_id?: string | null;
  medical_expert_id?: string | null;
  notes?: string;
  case_appointment_ids?: string[];
}

async function fetchAccounts(includeDeleted: boolean): Promise<ExternalPortalAccountWithMeta[]> {
  let query = supabase
    .from('external_portal_accounts' as any)
    .select('*')
    .order('created_at', { ascending: false });

  if (!includeDeleted) {
    query = query.is('deleted_at', null);
  } else {
    query = query.not('deleted_at', 'is', null);
  }

  const { data, error } = await query;
  if (error) throw error;

  const accounts = (data || []) as unknown as ExternalPortalAccount[];
  if (accounts.length === 0) return [];

  const accountIds = accounts.map((a) => a.id);
  const { data: links, error: linksError } = await supabase
    .from('external_portal_case_links' as any)
    .select('account_id, appointment_id, revoked_at, appointments:appointment_id(case_status)')
    .in('account_id', accountIds);

  if (linksError) throw linksError;

  const linkRows = (links || []) as unknown as Array<{
    account_id: string;
    appointment_id: string;
    revoked_at: string | null;
    appointments: { case_status: string | null } | null;
  }>;

  const { data: pendingLinks } = await supabase
    .from('external_portal_access_links' as any)
    .select('account_id, status')
    .in('account_id', accountIds)
    .eq('status', 'pending');

  const activeLinkAccountIds = new Set(
    ((pendingLinks || []) as unknown as Array<{ account_id: string }>).map((l) => l.account_id)
  );

  return accounts.map((account) => {
    const accountLinks = linkRows.filter((l) => l.account_id === account.id && !l.revoked_at);
    const openCount = accountLinks.filter((l) => l.appointments?.case_status === 'scheduled').length;
    return {
      ...account,
      linked_case_count: accountLinks.length,
      open_case_count: openCount,
      active_access_link: activeLinkAccountIds.has(account.id),
    };
  });
}

export function useExternalPortalAccounts(includeDeleted = false) {
  return useQuery({
    queryKey: [...QUERY_KEY, includeDeleted],
    queryFn: () => fetchAccounts(includeDeleted),
    staleTime: 30_000,
  });
}

export function useCreateExternalPortalAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateExternalPortalAccountInput) => {
      const { data: userData } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('external_portal_accounts' as any)
        .insert({
          portal_type: input.portal_type,
          full_name: input.full_name.trim(),
          email: input.email.trim().toLowerCase(),
          phone: input.phone?.trim() || null,
          referring_attorney_id: input.referring_attorney_id || null,
          medical_expert_id: input.medical_expert_id || null,
          notes: input.notes?.trim() || null,
          created_by: userData?.user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;
      const account = data as unknown as ExternalPortalAccount;

      if (input.case_appointment_ids && input.case_appointment_ids.length > 0) {
        const { error: linkError } = await supabase.from('external_portal_case_links' as any).insert(
          input.case_appointment_ids.map((appointment_id) => ({
            account_id: account.id,
            appointment_id,
            granted_by: userData?.user?.id || null,
          }))
        );
        if (linkError) throw linkError;
      }

      await supabase.rpc('external_portal_log_audit' as any, {
        _actor_type: 'admin',
        _actor_id: userData?.user?.id || null,
        _account_id: account.id,
        _action: 'account_created',
        _details: { portal_type: input.portal_type, email: account.email },
      });

      return account;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('External portal account created');
    },
    onError: (error: any) => {
      const msg = error?.message?.includes('external_portal_accounts_email_active_uq')
        ? 'An active account with this email already exists for this portal type.'
        : error?.message || 'Failed to create account';
      toast.error(msg);
    },
  });
}

export function useSetExternalPortalAccountStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      accountId,
      status,
      reason,
    }: {
      accountId: string;
      status: ExternalPortalAccountStatus;
      reason?: string;
    }) => {
      const { error } = await supabase.rpc('external_portal_set_account_status' as any, {
        _account_id: accountId,
        _new_status: status,
        _reason: reason || null,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      const verb: Record<ExternalPortalAccountStatus, string> = {
        active: 'restored to Active',
        paused: 'paused',
        expired: 'marked Expired',
        deleted: 'moved to Recycle Bin',
      };
      toast.success(`Account ${verb[variables.status]}`);
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to update account status'),
  });
}

export function usePermanentlyDeleteExternalPortalAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (accountId: string) => {
      const { error } = await supabase.rpc('external_portal_permanently_delete_account' as any, {
        _account_id: accountId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Account permanently deleted');
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to permanently delete account'),
  });
}

/** Convenience wrapper so pages don't each re-derive the "restore" semantics. */
export function useRestoreExternalPortalAccount() {
  const setStatus = useSetExternalPortalAccountStatus();
  return useCallback(
    (accountId: string) => setStatus.mutateAsync({ accountId, status: 'active' }),
    [setStatus]
  );
  }
