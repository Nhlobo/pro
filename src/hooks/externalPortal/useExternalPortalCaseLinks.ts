import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ExternalPortalAccount } from '@/types/externalPortal';

/**
 * External Portal Module — admin-side case access (external_portal_case_links).
 *
 * This is a deliberately separate grant from "which cases can this
 * attorney/expert see in My Cases" (that's the broader
 * referring_attorney_id / expert_id RLS scope, already correct and
 * untouched). A case_links row specifically opens up the Messages
 * thread for one appointment — an admin decision, not automatic.
 */

export interface LinkableCase {
  appointment_id: string;
  claimant_name: string;
  claimant_auto_id: string | null;
  appointment_date: string | null;
  case_status: string | null;
  is_linked: boolean;
}

export function useExternalPortalLinkableCases(account: ExternalPortalAccount | null) {
  return useQuery({
    queryKey: ['external-portal', 'linkable-cases', account?.id],
    queryFn: async (): Promise<LinkableCase[]> => {
      if (!account) return [];
      const personColumn = account.portal_type === 'attorney' ? 'referring_attorney_id' : 'expert_id';
      const personId = account.portal_type === 'attorney' ? account.referring_attorney_id : account.medical_expert_id;
      if (!personId) return [];

      const [{ data: appointments, error: apptError }, { data: links, error: linkError }] = await Promise.all([
        supabase
          .from('appointments')
          .select('id, appointment_date, case_status, claimants(first_name, last_name, auto_id)')
          .eq(personColumn, personId)
          .is('deleted_at', null)
          .order('appointment_date', { ascending: false })
          .limit(100),
        supabase
          .from('external_portal_case_links' as any)
          .select('appointment_id, revoked_at')
          .eq('account_id', account.id),
      ]);
      if (apptError) throw apptError;
      if (linkError) throw linkError;

      const linkedSet = new Set(
        ((links || []) as { appointment_id: string; revoked_at: string | null }[])
          .filter((l) => !l.revoked_at)
          .map((l) => l.appointment_id)
      );

      return (appointments || []).map((appt) => {
        const claimant = Array.isArray(appt.claimants) ? appt.claimants[0] : appt.claimants;
        return {
          appointment_id: appt.id,
          claimant_name: claimant ? `${claimant.first_name || ''} ${claimant.last_name || ''}`.trim() : 'Unknown claimant',
          claimant_auto_id: claimant?.auto_id || null,
          appointment_date: appt.appointment_date,
          case_status: appt.case_status,
          is_linked: linkedSet.has(appt.id),
        };
      });
    },
    enabled: !!account,
    staleTime: 15_000,
  });
}

export function useToggleExternalPortalCaseLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ accountId, appointmentId, link }: { accountId: string; appointmentId: string; link: boolean }) => {
      const { data: userData } = await supabase.auth.getUser();

      if (link) {
        // Re-linking after a prior revoke needs an update, not a second
        // insert — (account_id, appointment_id) is unique.
        const { data: existing } = await supabase
          .from('external_portal_case_links' as any)
          .select('id')
          .eq('account_id', accountId)
          .eq('appointment_id', appointmentId)
          .maybeSingle();

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
      } else {
        const { error } = await supabase
          .from('external_portal_case_links' as any)
          .update({ revoked_at: new Date().toISOString() })
          .eq('account_id', accountId)
          .eq('appointment_id', appointmentId);
        if (error) throw error;
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['external-portal', 'linkable-cases', variables.accountId] });
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to update case access'),
  });
}
