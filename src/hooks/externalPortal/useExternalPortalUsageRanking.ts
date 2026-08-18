import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ExternalPortalPersonByUsage } from '@/types/externalPortal';

/**
 * External Portal Module — usage-ranked person pickers.
 *
 * Backed by the `external_portal_referring_attorneys_by_usage()` /
 * `external_portal_medical_experts_by_usage()` SQL functions (Phase 10
 * migration). Both are SECURITY DEFINER + admin-gated server-side, so
 * calling them via RPC needs no service-role key and no Edge Function —
 * RLS on the underlying tables is bypassed deliberately inside the
 * function body, same pattern as every other lifecycle RPC in this
 * module (see external_portal_set_account_status, etc).
 *
 * "Usage" = count of that person's appointments, excluding
 * soft-deleted (deleted_at) and cancelled (case_status) rows — this is
 * a business decision confirmed with the admin, not an arbitrary
 * choice; see the Phase 10 migration comments for the same note.
 *
 * Results already arrive most-used → least-used from the SQL function
 * (ORDER BY usage_count DESC, name ASC) — these hooks intentionally do
 * not re-sort client-side.
 */

interface ReferringAttorneyUsageRow {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  usage_count: number;
}

interface MedicalExpertUsageRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  usage_count: number;
}

export function useReferringAttorneysByUsage() {
  return useQuery({
    queryKey: ['external-portal', 'referring-attorneys-by-usage'],
    queryFn: async (): Promise<ExternalPortalPersonByUsage[]> => {
      const { data, error } = await supabase.rpc('external_portal_referring_attorneys_by_usage' as any);
      if (error) throw error;
      return ((data || []) as ReferringAttorneyUsageRow[]).map((row) => ({
        id: row.id,
        display_name: row.name,
        email: row.email,
        usage_count: Number(row.usage_count) || 0,
      }));
    },
    staleTime: 60_000,
  });
}

export function useMedicalExpertsByUsage() {
  return useQuery({
    queryKey: ['external-portal', 'medical-experts-by-usage'],
    queryFn: async (): Promise<ExternalPortalPersonByUsage[]> => {
      const { data, error } = await supabase.rpc('external_portal_medical_experts_by_usage' as any);
      if (error) throw error;
      return ((data || []) as MedicalExpertUsageRow[]).map((row) => ({
        id: row.id,
        display_name: `${row.last_name}, ${row.first_name}`,
        email: row.email,
        usage_count: Number(row.usage_count) || 0,
      }));
    },
    staleTime: 60_000,
  });
}
