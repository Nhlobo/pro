import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface AttorneyFirmName {
  /** e.g. "Mavuya Attorney" — the referring_attorneys.name (law firm/practice name) */
  firmName: string | null;
  /** The signed-in individual's own name, from profiles.first_name/last_name */
  personName: string | null;
  /**
   * True when personName and firmName are effectively the same text (case,
   * spacing, and trailing-space differences ignored). Confirmed live: some
   * attorney portal accounts have the firm's own name entered into
   * first_name/last_name instead of a real contact person's name (e.g.
   * first_name "Samora", last_name "Mabasa attorneys", against a firm named
   * "Samora Mabasa attorneys") — showing both then reads as "Welcome,
   * <name> — <name>", the same text twice. Callers should show only
   * firmName when this is true.
   */
  namesAreDuplicates: boolean;
  loading: boolean;
}

const normalizeForComparison = (value: string | null): string =>
  (value || '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Client request: "Dashboard must be written the name of the Attorney e.g.
 * Mavuya Attorney, so each referring attorney must be welcomed by the
 * lawfirm's [name]". AttorneyPortalLayout previously only showed the login
 * email and a static "Referring Attorney" label — it never looked up the
 * firm record at all. Resolves both the firm name (referring_attorneys.name)
 * and the individual's own name so the header can greet either "Welcome,
 * <person> — <firm>" or just the firm name if the person's name isn't set.
 */
export const useAttorneyFirmName = (): AttorneyFirmName => {
  const { user } = useAuth();
  const [firmName, setFirmName] = useState<string | null>(null);
  const [personName, setPersonName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchNames = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('referring_attorney_id, first_name, last_name')
        .eq('id', user.id)
        .single();

      if (cancelled) return;

      const fullPersonName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim();
      setPersonName(fullPersonName || null);

      if (profile?.referring_attorney_id) {
        const { data: firm } = await supabase
          .from('referring_attorneys')
          .select('name')
          .eq('id', profile.referring_attorney_id)
          .maybeSingle();
        if (!cancelled) setFirmName(firm?.name || null);
      }

      if (!cancelled) setLoading(false);
    };

    fetchNames();
    return () => { cancelled = true; };
  }, [user]);

  return {
    firmName,
    personName,
    namesAreDuplicates: normalizeForComparison(personName) !== '' && normalizeForComparison(personName) === normalizeForComparison(firmName),
    loading,
  };
};

export default useAttorneyFirmName;
