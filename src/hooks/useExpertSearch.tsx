// src/hooks/useExpertSearch.tsx
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

/* ------------------------------------------------------------------ */
/* Domain data & logic — unchanged from the previous implementation   */
/* ------------------------------------------------------------------ */

export const SA_PROVINCES = [
  'Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape',
  'Free State', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape',
];

export const MEDICO_LEGAL_PROFESSIONS = [
  'Orthopaedic Surgeon', 'Neurosurgeon', 'Occupational Therapist', 'Clinical Psychologist',
  'Industrial Psychologist', 'Psychiatrist', 'Neurologist', 'Plastic Surgeon', 'General Surgeon',
  'Speech Therapist', 'Audiologist', 'Physiotherapist', 'Educational Psychologist', 'Actuary',
  'Nursing Expert', 'Emergency Medicine Specialist', 'Radiologist', 'Urologist', 'Gynaecologist',
  'Paediatrician', 'Dentist', 'Maxillofacial Surgeon', 'Ophthalmologist',
];

export interface InternalExpert {
  id: string;
  first_name: string;
  last_name: string;
  expert_type: string;
  province: string;
  city: string | null;
  languages: string[] | null;
  hpcsa_number: string | null;
  medico_legal_years_experience: number | null;
  years_experience: number | null;
  matter_types: string[] | null;
  status: string;
  cv_document_url: string | null;
  virtual_assessment: boolean | null;
  assessment_turnaround_days: number | null;
  report_turnaround_days: number | null;
  email: string | null;
  contact_number: string | null;
  medico_legal_only: boolean | null;
}

export interface ExternalResult {
  source_url: string;
  title: string;
  snippet: string;
  name?: string;
  registry_id?: string;
  province?: string;
  city?: string;
  profession?: string;
  trusted?: boolean;
  sources?: { url: string; host: string; title: string; trusted: boolean }[];
  sources_count?: number;
  emails?: string[];
  phones?: string[];
  websites?: { url: string; host: string }[];
}

const fuzzy = (haystack: string, needle: string) => {
  if (!needle) return true;
  return haystack.toLowerCase().includes(needle.toLowerCase());
};

interface SearchFilters {
  province: string;
  city: string;
  profession: string;
}

interface ExternalOverrides {
  trustedOnly?: boolean;
  limit?: number;
  includeRecomed?: boolean;
  includeMedpages?: boolean;
}

/**
 * Expert-search data layer shared by the Find Experts page.
 *
 * Same three data sources as before, same query semantics:
 *  - `sa_districts` lookup keyed by province
 *  - `medical_experts` internal search with the exact same filter/relevance
 *    rules (medico_legal_only gate, city fuzzy match, profession match,
 *    RAF/med-neg matter gate)
 *  - the `find-experts-external` edge function for public directories
 *
 * All three are now react-query mutations/queries instead of manual
 * `useState` + `try/catch` blocks, which gives consistent loading/error
 * state and lets the page component stay purely presentational.
 */
export const useExpertSearch = () => {
  const { toast } = useToast();
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [profession, setProfession] = useState('');
  const [professionQuery, setProfessionQuery] = useState('');

  const [trustedOnly, setTrustedOnly] = useState(false);
  const [externalLimit, setExternalLimit] = useState(40);
  const [includeRecomed, setIncludeRecomed] = useState(true);
  const [includeMedpages, setIncludeMedpages] = useState(true);
  const [hasSearchedExternal, setHasSearchedExternal] = useState(false);

  const professionOptions = useMemo(() => {
    const q = professionQuery.toLowerCase();
    return MEDICO_LEGAL_PROFESSIONS.filter((p) => p.toLowerCase().includes(q));
  }, [professionQuery]);

  /* ---------------- Districts (dependent on province) ---------------- */
  const { data: districts = [], isLoading: loadingDistricts } = useQuery({
    queryKey: ['sa-districts', province],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sa_districts')
        .select('name')
        .eq('province', province)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((d: { name: string }) => d.name);
    },
    enabled: !!province,
  });

  /* ---------------- Internal (platform) search ---------------- */
  const internalSearchMutation = useMutation({
    mutationFn: async (filters: SearchFilters) => {
      let q = supabase
        .from('medical_experts')
        .select('id, first_name, last_name, expert_type, province, city, languages, hpcsa_number, medico_legal_years_experience, years_experience, matter_types, status, cv_document_url, virtual_assessment, assessment_turnaround_days, report_turnaround_days, email, contact_number, medico_legal_only')
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(200);

      if (filters.province) q = q.ilike('province', `%${filters.province}%`);

      const { data, error } = await q;
      if (error) throw error;

      return ((data || []) as any[]).filter((e) => {
        if (e.medico_legal_only === false) return false;
        if (filters.city && e.city && !fuzzy(e.city, filters.city)) return false;
        if (filters.profession && !fuzzy(e.expert_type || '', filters.profession.replace(/\s+/g, ''))) {
          const flat = (e.expert_type || '').replace(/[_\s]/g, '').toLowerCase();
          const want = filters.profession.replace(/[_\s]/g, '').toLowerCase();
          if (!flat.includes(want.slice(0, 6))) return false;
        }
        const matters = (e.matter_types || []).map((m: string) => m.toLowerCase());
        if (matters.length > 0) {
          const ok = matters.some((m: string) =>
            m.includes('raf') || m.includes('road accident') || m.includes('negligence') || m.includes('medico'),
          );
          if (!ok) return false;
        }
        return true;
      }) as InternalExpert[];
    },
    onError: (err: any) => {
      toast({ title: 'Search failed', description: err.message, variant: 'destructive' });
    },
  });

  /* ---------------- External (public directory) search ---------------- */
  const externalSearchMutation = useMutation({
    mutationFn: async (vars: { filters: SearchFilters; overrides?: ExternalOverrides }) => {
      const { filters, overrides } = vars;
      const useTrustedOnly = overrides?.trustedOnly ?? trustedOnly;
      const useLimit = overrides?.limit ?? externalLimit;
      const useRecomed = overrides?.includeRecomed ?? includeRecomed;
      const useMedpages = overrides?.includeMedpages ?? includeMedpages;

      const { data, error } = await supabase.functions.invoke('find-experts-external', {
        body: {
          province: filters.province, city: filters.city, expertType: filters.profession,
          limit: useLimit, trustedOnly: useTrustedOnly,
          includeRecomed: useRecomed, includeMedpages: useMedpages,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return {
        results: (data?.results ?? []) as ExternalResult[],
        trustedTotal: typeof data?.trusted_total === 'number' ? data.trusted_total : null,
        total: typeof data?.total === 'number' ? data.total : (data?.results ?? []).length,
      };
    },
    onError: (err: any) => {
      toast({ title: 'External search failed', description: err.message || 'Unknown error', variant: 'destructive' });
    },
  });

  const runInternalSearch = () => internalSearchMutation.mutate({ province, city, profession });

  const runExternalSearch = (overrides?: ExternalOverrides) => {
    if (!profession) {
      toast({ title: 'Select a profession', description: 'Profession is required for external search.', variant: 'destructive' });
      return;
    }
    setHasSearchedExternal(true);
    externalSearchMutation.mutate({ filters: { province, city, profession }, overrides });
  };

  const handleSearch = () => {
    runInternalSearch();
    runExternalSearch();
  };

  const handleReset = () => {
    setProvince('');
    setCity('');
    setProfession('');
    setProfessionQuery('');
    setHasSearchedExternal(false);
    externalSearchMutation.reset();
    internalSearchMutation.mutate({ province: '', city: '', profession: '' });
  };

  // Initial platform search on mount — mirrors the previous behaviour of
  // showing the (unfiltered) platform directory as soon as the page loads.
  useEffect(() => {
    internalSearchMutation.mutate({ province: '', city: '', profession: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const internal = internalSearchMutation.data || [];
  const external = externalSearchMutation.data?.results || [];

  const recommended = useMemo(() => {
    return [...internal]
      .sort((a, b) => {
        const aScore = (a.medico_legal_years_experience || a.years_experience || 0) - (a.report_turnaround_days || 30) * 0.2;
        const bScore = (b.medico_legal_years_experience || b.years_experience || 0) - (b.report_turnaround_days || 30) * 0.2;
        return bScore - aScore;
      })
      .slice(0, 4);
  }, [internal]);

  return {
    // filters
    province, setProvince: (v: string) => { setProvince(v); setCity(''); },
    city, setCity,
    profession, setProfession,
    professionQuery, setProfessionQuery,
    professionOptions,
    districts, loadingDistricts,

    // internal results
    internal, recommended,
    loadingInternal: internalSearchMutation.isPending,

    // external results
    external,
    loadingExternal: externalSearchMutation.isPending,
    externalError: externalSearchMutation.error ? (externalSearchMutation.error as any).message : null,
    trustedTotal: externalSearchMutation.data?.trustedTotal ?? null,
    externalTotal: externalSearchMutation.data?.total ?? null,
    hasSearchedExternal,

    // external controls
    trustedOnly, setTrustedOnly,
    externalLimit, setExternalLimit,
    includeRecomed, setIncludeRecomed,
    includeMedpages, setIncludeMedpages,

    // actions
    runExternalSearch,
    handleSearch,
    handleReset,
    isSearching: internalSearchMutation.isPending || externalSearchMutation.isPending,
  };
};
