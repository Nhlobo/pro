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
