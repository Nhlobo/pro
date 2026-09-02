import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useSalesIncentives } from '@/hooks/useSalesIncentives';
import { format } from 'date-fns';

/**
 * Data layer for the Attorney Pitchlog page.
 *
 * `attorney_pitchlog` is a real, actively-written table (see
 * useSecureAssessments.tsx's auto-attribution insert, and
 * usePitchlogFollowUpReminders.tsx / useSalesConsultantStats.tsx which both
 * already read from it) — but no page in this codebase let anyone browse or
 * manually manage its rows. This hook + AttorneyPitchlog.tsx together
 * rebuild that missing management UI from the table schema and its RLS
 * policies (see supabase/migrations/20260901073000_attorney_pitchlog_consultant_id_and_rls.sql),
 * matching the field/value conventions already established by the one real
 * write path in useSecureAssessments.tsx (practice_area 'RAF'/'Med Neg',
 * attorney_type 'Plaintiff'/'Defendant', month_year as 'yyyy-MM', pitch
 * statuses 'Pitched' / 'Re-pitched' / 'Followed Up' / 'Interested').
 *
 * RLS already scopes sales consultants to their own consultant_id rows and
 * gives admins/employees full access via a separate existing policy, so no
 * client-side filtering is required for correctness — this hook simply
 * fetches whatever the database allows the current user to see.
 */

export interface PitchlogEntry {
  id: string;
  law_firm_name: string;
  contact_person: string;
  email: string | null;
  telephone: string | null;
  province: string;
  practice_area: string;
  attorney_type: string;
  pitch_status: string;
  follow_up_date: string | null;
  identified_challenge: string | null;
  meeting_function: string | null;
  comment: string | null;
  comment_2: string | null;
  deal_closed: boolean | null;
  deal_closed_date: string | null;
  matched_referring_attorney_id: string | null;
  consultant_id: string | null;
  sales_person: string;
  month_year: string;
  created_at: string | null;
  updated_at: string | null;
}

export type PitchlogFormInput = {
  law_firm_name: string;
  contact_person: string;
  email: string | null;
  telephone: string | null;
  province: string;
  practice_area: string;
  attorney_type: string;
  pitch_status: string;
  follow_up_date: string | null;
  identified_challenge: string | null;
  meeting_function: string | null;
  comment: string | null;
  deal_closed: boolean;
  deal_closed_date: string | null;
  matched_referring_attorney_id: string | null;
  consultant_id: string | null;
  sales_person: string;
};

/** Only 'Pitched' / 'Re-pitched' / 'Followed Up' / 'Interested' feed the existing
 *  stats on SalesConsultantStats/SalesDashboard — 'Not Interested' is added here
 *  as a sensible pipeline terminus but isn't counted anywhere else yet. */
export const PITCH_STATUSES = ['Pitched', 'Re-pitched', 'Followed Up', 'Interested', 'Not Interested'] as const;
export const PRACTICE_AREAS = ['RAF', 'Med Neg'] as const;
export const ATTORNEY_TYPES = ['Plaintiff', 'Defendant'] as const;
export const PROVINCES = [
  'Gauteng', 'KwaZulu-Natal', 'Eastern Cape', 'Limpopo', 'Mpumalanga',
  'North West', 'Northern Cape', 'Free State', 'Western Cape',
];

export const useAttorneyPitchlog = () => {
  const { toast } = useToast();
  const { isAdmin } = usePermissions();
  const admin = isAdmin();
  // Reuses the same "who am I / all consultants" fetch SalesDashboard already
  // relies on, instead of duplicating that query here.
  const { consultant, allConsultants } = useSalesIncentives();

  const [entries, setEntries] = useState<PitchlogEntry[]>([]);
  const [referringAttorneys, setReferringAttorneys] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('attorney_pitchlog')
        .select('*')
        .order('created_at', { ascending: false });
      if (err) throw err;
      setEntries((data || []) as PitchlogEntry[]);
    } catch (e: any) {
      setError(e?.message || 'Failed to load the pitch log');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchReferringAttorneys = useCallback(async () => {
    const { data } = await supabase.from('referring_attorneys').select('id, name').order('name');
    setReferringAttorneys(data || []);
  }, []);

  useEffect(() => {
    fetchEntries();
    fetchReferringAttorneys();
  }, [fetchEntries, fetchReferringAttorneys]);

  const addEntry = async (input: PitchlogFormInput): Promise<boolean> => {
    setSaving(true);
    try {
      const month_year = format(new Date(), 'yyyy-MM');
      const { error: err } = await supabase.from('attorney_pitchlog').insert({ ...input, month_year });
      if (err) throw err;
      toast({ title: 'Pitch logged', description: `${input.law_firm_name} added to the pitch log.` });
      await fetchEntries();
      return true;
    } catch (e: any) {
      toast({ title: 'Could not save pitch', description: e?.message, variant: 'destructive' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const updateEntry = async (id: string, input: PitchlogFormInput): Promise<boolean> => {
    setSaving(true);
    try {
      const { error: err } = await supabase.from('attorney_pitchlog').update(input).eq('id', id);
      if (err) throw err;
      toast({ title: 'Pitch updated' });
      await fetchEntries();
      return true;
    } catch (e: any) {
      toast({ title: 'Could not update pitch', description: e?.message, variant: 'destructive' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = async (id: string): Promise<boolean> => {
    setSaving(true);
    try {
      const { error: err } = await supabase.from('attorney_pitchlog').delete().eq('id', id);
      if (err) throw err;
      toast({ title: 'Pitch entry removed' });
      await fetchEntries();
      return true;
    } catch (e: any) {
      toast({ title: 'Could not remove entry', description: e?.message, variant: 'destructive' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    entries,
    loading,
    error,
    saving,
    referringAttorneys,
    consultant,
    allConsultants,
    admin,
    refetch: fetchEntries,
    addEntry,
    updateEntry,
    deleteEntry,
  };
};

export default useAttorneyPitchlog;
