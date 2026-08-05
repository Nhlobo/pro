import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Admin-side case linking for the External Portal Module.
 *
 * This is the piece that makes external_portal_case_links (created in
 * Phase 1) actually usable from the UI: search existing appointments
 * and attach/detach them to a portal account. It never creates or
 * edits case data itself — only the link row that grants an account
 * visibility into an existing case.
 */

export interface LinkedCaseRow {
  link_id: string;
  appointment_id: string;
  granted_at: string;
  appointment_date: string;
  case_status: string | null;
  matter_type: string | null;
  claimant_name: string;
  claimant_reference: string | null;
}

export function useAccountCaseLinks(accountId: string | null) {
  return useQuery({
    queryKey: ['external-portal', 'case-links', accountId],
    queryFn: async (): Promise<LinkedCaseRow[]> => {
      const { data, error } = await supabase
        .from('external_portal_case_links' as any)
        .select(`
          id, appointment_id, granted_at,
          appointment:appointment_id (
            id, appointment_date, case_status, matter_type,
            claimant:claimant_id ( first_name, last_name, auto_id )
          )
        `)
        .eq('account_id', accountId)
        .is('revoked_at', null)
        .order('granted_at', { ascending: false });

      if (error) throw error;

      return ((data || []) as any[])
        .filter((row) => row.appointment)
        .map((row) => ({
          link_id: row.id,
          appointment_id: row.appointment_id,
          granted_at: row.granted_at,
          appointment_date: row.appointment.appointment_date,
          case_status: row.appointment.case_status,
          matter_type: row.appointment.matter_type,
          claimant_name: row.appointment.claimant
            ? `${row.appointment.claimant.first_name} ${row.appointment.claimant.last_name}`
            : 'Unknown claimant',
          claimant_reference: row.appointment.claimant?.auto_id ?? null,
        }));
    },
    enabled: !!accountId,
    staleTime: 10_000,
  });
}

export interface SearchableCase {
  appointment_id: string;
  appointment_date: string;
  case_status: string | null;
  matter_type: string | null;
  claimant_name: string;
  claimant_reference: string | null;
}

export function useSearchCases(query: string) {
  return useQuery({
    queryKey: ['external-portal', 'case-search', query],
    queryFn: async (): Promise<SearchableCase[]> => {
      if (!query.trim() || query.trim().length < 2) return [];

      // claimants first (name/reference match), then their appointments —
      // avoids needing a Postgres full-text join across two tables in one call.
      const { data: claimants, error: claimantError } = await supabase
        .from('claimants')
        .select('id, first_name, last_name, auto_id')
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,auto_id.ilike.%${query}%`)
        .limit(10);

      if (claimantError) throw claimantError;
      if (!claimants || claimants.length === 0) return [];

      const { data: appointments, error: apptError } = await supabase
        .from('appointments')
        .select('id, appointment_date, case_status, matter_type, claimant_id')
        .in('claimant_id', claimants.map((c) => c.id))
        .order('appointment_date', { ascending: false })
        .limit(20);

      if (apptError) throw apptError;

      const claimantById = new Map(claimants.map((c) => [c.id, c]));

      return (appointments || []).map((a) => {
        const c = claimantById.get(a.claimant_id);
        return {
          appointment_id: a.id,
          appointment_date: a.appointment_date,
          case_status: a.case_status,
          matter_type: a.matter_type,
          claimant_name: c ? `${c.first_name} ${c.last_name}` : 'Unknown claimant',
          claimant_reference: c?.auto_id ?? null,
        };
      });
    },
    enabled: query.trim().length >= 2,
    staleTime: 10_000,
  });
}

export function useLinkCaseToAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ accountId, appointmentId }: { accountId: string; appointmentId: string }) => {
      const { data: userData } = await supabase.auth.getUser();

      // A prior revoked link for the same account+case would violate the
      // unique (account_id, appointment_id) constraint on a fresh insert —
      // reactivate it instead if one exists.
      const { data: existing } = await supabase
        .from('external_portal_case_links' as any)
        .select('id, revoked_at')
        .eq('account_id', accountId)
        .eq('appointment_id', appointmentId)
        .maybeSingle();

      if (existing && !(existing as any).revoked_at) {
        throw new Error('This case is already linked to this account.');
      }

      if (existing) {
        const { error } = await supabase
          .from('external_portal_case_links' as any)
          .update({ revoked_at: null, granted_by: userData?.user?.id || null, granted_at: new Date().toISOString() })
          .eq('id', (existing as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('external_portal_case_links' as any).insert({
          account_id: accountId,
          appointment_id: appointmentId,
          granted_by: userData?.user?.id || null,
        });
        if (error) throw error;
      }

      await supabase.rpc('external_portal_log_audit' as any, {
        _actor_type: 'admin',
        _actor_id: userData?.user?.id || null,
        _account_id: accountId,
        _action: 'case_linked',
        _details: { appointment_id: appointmentId },
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['external-portal', 'case-links', variables.accountId] });
      queryClient.invalidateQueries({ queryKey: ['external-portal', 'accounts'] });
      toast.success('Case linked to account');
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to link case'),
  });
}

export function useUnlinkCaseFromAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ linkId, accountId }: { linkId: string; accountId: string }) => {
      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('external_portal_case_links' as any)
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', linkId);
      if (error) throw error;

      await supabase.rpc('external_portal_log_audit' as any, {
        _actor_type: 'admin',
        _actor_id: userData?.user?.id || null,
        _account_id: accountId,
        _action: 'case_unlinked',
        _details: { link_id: linkId },
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['external-portal', 'case-links', variables.accountId] });
      queryClient.invalidateQueries({ queryKey: ['external-portal', 'accounts'] });
      toast.success('Case unlinked');
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to unlink case'),
  });
}
