import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Phase 14 — the individual person a case/portal account is actually
 * assigned to, distinct from the firm (`referring_attorneys`). See
 * migration 20260819120000 for why this exists: appointments never
 * recorded this before, only the firm.
 */
export interface ReferringAttorneyContact {
  id: string;
  referring_attorney_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

export function useReferringAttorneyContacts(referringAttorneyId: string | null) {
  return useQuery({
    queryKey: ['external-portal', 'attorney-contacts', referringAttorneyId],
    queryFn: async (): Promise<ReferringAttorneyContact[]> => {
      if (!referringAttorneyId) return [];
      const { data, error } = await supabase
        .from('referring_attorney_contacts' as any)
        .select('*')
        .eq('referring_attorney_id', referringAttorneyId)
        .eq('is_active', true)
        .order('full_name', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ReferringAttorneyContact[];
    },
    enabled: !!referringAttorneyId,
    staleTime: 15_000,
  });
}

/**
 * Phase 22 — same contacts as useReferringAttorneyContacts, but each
 * one annotated with its own case count (non-deleted, non-cancelled
 * appointments assigned to that specific individual). Used in the
 * account-creation picker so the admin can see, BEFORE creating an
 * individual-scoped account, what that account will actually see —
 * which is a subset of the firm's total case count shown one step
 * earlier, not the same number.
 */
export interface ReferringAttorneyContactWithUsage extends ReferringAttorneyContact {
  usage_count: number;
}

export function useReferringAttorneyContactsByUsage(referringAttorneyId: string | null) {
  return useQuery({
    queryKey: ['external-portal', 'attorney-contacts-by-usage', referringAttorneyId],
    queryFn: async (): Promise<ReferringAttorneyContactWithUsage[]> => {
      if (!referringAttorneyId) return [];
      const { data, error } = await supabase.rpc(
        'external_portal_attorney_contacts_by_usage' as any,
        { p_referring_attorney_id: referringAttorneyId }
      );
      if (error) throw error;
      return ((data || []) as any[]).map((row) => ({
        id: row.id,
        referring_attorney_id: row.referring_attorney_id,
        full_name: row.full_name,
        email: row.email,
        phone: row.phone,
        is_active: row.is_active,
        created_at: row.created_at ?? '',
        usage_count: Number(row.usage_count) || 0,
      }));
    },
    enabled: !!referringAttorneyId,
    staleTime: 15_000,
  });
}

export function useCreateReferringAttorneyContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { referring_attorney_id: string; full_name: string; email?: string | null; phone?: string | null }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('referring_attorney_contacts' as any)
        .insert({
          referring_attorney_id: input.referring_attorney_id,
          full_name: input.full_name.trim(),
          email: input.email?.trim() || null,
          phone: input.phone?.trim() || null,
          created_by: userData?.user?.id || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ReferringAttorneyContact;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['external-portal', 'attorney-contacts', variables.referring_attorney_id] });
    },
    onError: (error: any) => {
      const msg = error?.message?.includes('referring_attorney_contacts_firm_email_uq')
        ? 'A contact with this email already exists at this firm — pick them from the list instead.'
        : error?.message || 'Failed to create attorney contact';
      toast.error(msg);
    },
  });
}
