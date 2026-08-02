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

// Platform `medical_experts.expert_type` values are stored as free-form
// snake_case (e.g. "orthopedic_surgeon", legacy "nurse", "emergency_medicine")
// rather than the exact MEDICO_LEGAL_PROFESSIONS label, and can use either
// British or American spelling. Each profession below lists every
// normalized (lowercase, letters-only) form its expert_type is known to take.
//
// This replaces a previous "same first 6 letters" fallback that could
// silently match the wrong specialty — e.g. a search for "Urologist" also
// matched experts filed as "Neurologist", because "urologist" happens to be
// a plain substring of "neurologist". Matching is exact-equality against
// this alias set instead of substring, so that specific mismatch can't recur.
const PROFESSION_MATCH_ALIASES: Record<string, string[]> = {
  'Orthopaedic Surgeon': ['orthopaedicsurgeon', 'orthopedicsurgeon', 'orthopaedic', 'orthopedic'],
  'Neurosurgeon': ['neurosurgeon'],
  'Occupational Therapist': ['occupationaltherapist'],
  'Clinical Psychologist': ['clinicalpsychologist'],
  'Industrial Psychologist': ['industrialpsychologist'],
  'Psychiatrist': ['psychiatrist'],
  'Neurologist': ['neurologist'],
  'Plastic Surgeon': ['plasticsurgeon', 'reconstructivesurgeon'],
  'General Surgeon': ['generalsurgeon'],
  'Speech Therapist': ['speechtherapist', 'speechlanguagetherapist'],
  'Audiologist': ['audiologist'],
  'Physiotherapist': ['physiotherapist', 'physicaltherapist'],
  'Educational Psychologist': ['educationalpsychologist'],
  'Actuary': ['actuary', 'actuarial'],
  'Nursing Expert': ['nursingexpert', 'nurse', 'registerednurse'],
  'Emergency Medicine Specialist': ['emergencymedicinespecialist', 'emergencymedicine'],
  'Radiologist': ['radiologist'],
  'Urologist': ['urologist'],
  'Gynaecologist': ['gynaecologist', 'gynecologist', 'obstetrician'],
  'Paediatrician': ['paediatrician', 'pediatrician'],
  'Dentist': ['dentist'],
  'Maxillofacial Surgeon': ['maxillofacialsurgeon', 'maxillofacial'],
  'Ophthalmologist': ['ophthalmologist'],
};

const normalizeForMatch = (s: string) => (s || '').toLowerCase().replace(/[^a-z]/g, '');

export const professionMatches = (expertType: string, profession: string): boolean => {
  if (!profession) return true;
  if (!expertType) return false;
  const flat = normalizeForMatch(expertType);
  const aliases = PROFESSION_MATCH_ALIASES[profession] ?? [normalizeForMatch(profession)];
  return aliases.includes(flat);
};

// Cheap edit-distance for typo tolerance in the free-text search box only
// (e.g. "orthopaedic" typed as "orthopedic" already matches via aliases,
// but "orthopaedci" or "neurosurgoen" should still resolve). Never used for
// the strict platform-data filter above — only for interpreting what the
// person typed.
const levenshtein = (a: string, b: string): number => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
};

// Looser cousin of `professionMatches` for parsing free text: tolerates a
// couple of typos ("neurosurgoen") and partial/prefix typing ("orthopaed").
// Distance budget scales with word length so short words still need to be
// close, long words can be off by a couple of letters.
const professionMatchesFuzzy = (flatWord: string, profession: string): boolean => {
  if (!flatWord) return false;
  const aliases = PROFESSION_MATCH_ALIASES[profession] ?? [normalizeForMatch(profession)];
  return aliases.some((alias) => {
    if (alias === flatWord) return true;
    if (alias.length >= 4 && (alias.startsWith(flatWord) || flatWord.startsWith(alias))) return true;
    const budget = flatWord.length <= 5 ? 1 : flatWord.length <= 9 ? 2 : 3;
    return levenshtein(alias, flatWord) <= budget;
  });
};

// Words that carry no location/profession meaning on their own — e.g. a
// user typing "neurosurgeon expert witness" is just naming the profession
// in the way lawyers refer to it ("we need an expert witness"), not
// searching for someone literally called "witness". Strip these out before
// trying to match a profession or province so the remaining tokens are the
// actual search term.
const QUERY_STOP_WORDS = new Set([
  'expert', 'experts', 'witness', 'witnesses', 'find', 'search', 'for',
  'a', 'an', 'the', 'near', 'in', 'at', 'specialist', 'specialists',
  'medico-legal', 'medicolegal', 'medico', 'legal', 'around', 'me', 'please',
  'need', 'looking', 'want', 'get', 'me', 'of', 'to',
]);

const tokenize = (s: string): string[] =>
  (s || '')
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);

export interface ParsedExpertQuery {
  profession: string; // one of MEDICO_LEGAL_PROFESSIONS, or '' if none detected
  province: string; // one of SA_PROVINCES, or '' if none detected
  city: string; // best-effort leftover text (may be empty)
  freeText: string; // raw leftover words after stop-word/province stripping, whether or not a profession was found
}

/**
 * Parses a free-text query like "neurosurgeon expert witness" or
 * "orthopaedic surgeon expert witness in Gauteng" into the same
 * province / city / profession filters the structured search uses, so a
 * single search box can drive the exact same query the dropdowns do.
 *
 * Matching is exact-alias based (reusing `professionMatches`), the same
 * safeguard used for platform results, so "urologist expert witness" can
 * never resolve to "Neurologist" the way a naive substring search would.
 */
export const parseExpertQuery = (query: string): ParsedExpertQuery => {
  let tokens = tokenize(query);

  // 1. Pull out a province, if named. Match on the province's own word set
  //    (e.g. "western" + "cape") appearing anywhere in the query, remove
  //    those words, and stop at the first match.
  let province = '';
  for (const p of SA_PROVINCES) {
    const pWords = tokenize(p);
    if (pWords.every((w) => tokens.includes(w))) {
      province = p;
      tokens = tokens.filter((t) => !pWords.includes(t));
      break;
    }
  }

  // 2. Drop filler words ("expert witness", "find", "near", ...).
  const remainder = tokens.filter((t) => !QUERY_STOP_WORDS.has(t));

  // 3. Try to match the *whole* remainder (joined, no spaces) against a
  //    profession's known aliases first — this is how multi-word
  //    professions like "Orthopaedic Surgeon" resolve correctly.
  const remainderFlat = remainder.join('');
  let profession = '';
  let leftoverTokens = remainder;

  if (remainderFlat) {
    const wholeMatch = MEDICO_LEGAL_PROFESSIONS.find((p) => professionMatches(remainderFlat, p));
    if (wholeMatch) {
      profession = wholeMatch;
      leftoverTokens = [];
    } else {
      // 4. Fall back to matching individual words (e.g. extra words like a
      //    city name are mixed in: "neurosurgeon expert witness cape town").
      for (let i = 0; i < remainder.length; i++) {
        const match = MEDICO_LEGAL_PROFESSIONS.find((p) => professionMatches(remainder[i], p));
        if (match) {
          profession = match;
          leftoverTokens = remainder.filter((_, idx) => idx !== i);
          break;
        }
      }
    }
  }

  // 5. Still nothing? Try a typo-tolerant pass over the whole remainder and
  //    each individual word before giving up — this is what lets something
  //    like "orthopaedic surgoen" or "gynae" still resolve to a profession
  //    instead of the search simply refusing to run.
  if (!profession && remainderFlat) {
    const fuzzyWhole = MEDICO_LEGAL_PROFESSIONS.find((p) => professionMatchesFuzzy(remainderFlat, p));
    if (fuzzyWhole) {
      profession = fuzzyWhole;
      leftoverTokens = [];
    } else {
      for (let i = 0; i < remainder.length; i++) {
        const match = MEDICO_LEGAL_PROFESSIONS.find((p) => professionMatchesFuzzy(remainder[i], p));
        if (match) {
          profession = match;
          leftoverTokens = remainder.filter((_, idx) => idx !== i);
          break;
        }
      }
    }
  }

  const city = leftoverTokens.join(' ').trim();
  // Whatever couldn't be resolved to a profession/province/city still
  // carries meaning (a surname, a niche specialty, an abbreviation) — keep
  // it as a free-text term so the caller can still search on it rather than
  // silently dropping it.
  const freeText = remainder.join(' ').trim();

  return { profession, province, city, freeText };
};

interface SearchFilters {
  province: string;
  city: string;
  profession: string;
  // Raw search term used when the text couldn't be resolved to a known
  // profession — matched broadly (name, expert type, HPCSA number, city)
  // instead of the search simply refusing to run.
  freeText?: string;
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

  // Free-text "quick search" box — e.g. "neurosurgeon expert witness".
  const [quickQuery, setQuickQuery] = useState('');
  const [lastParsedQuery, setLastParsedQuery] = useState<ParsedExpertQuery | null>(null);

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

        if (filters.profession) {
          if (!professionMatches(e.expert_type || '', filters.profession)) return false;
        } else if (filters.freeText) {
          // No recognised profession — behave like a general search box
          // instead of returning nothing: match the term against name,
          // raw expert type, city, and HPCSA number.
          const haystack = [
            e.first_name, e.last_name, e.expert_type, e.city, e.hpcsa_number,
          ].filter(Boolean).join(' ');
          if (!fuzzy(haystack, filters.freeText)) return false;
        }

        // Gate: only show experts who handle RAF/Road Accident Fund or
        // Medical Negligence matters. The expert intake form stores this as
        // the literal enum "MVA" | "Med Neg" (see MedicalExpertFormPage.tsx),
        // never as the words "raf" or "negligence" — the previous substring
        // list checked for words that don't occur in real data, so every
        // expert with a matter type set (virtually all of them, since it's
        // a required field defaulting to ["MVA"]) was silently dropped here,
        // making Platform Experts show 0 regardless of filters. Matching
        // against the actual stored values first, with the older substrings
        // kept as a fallback for any legacy/free-form rows.
        const matters = (e.matter_types || []).map((m: string) => m.toLowerCase());
        if (matters.length > 0) {
          const ok = matters.some((m: string) =>
            m.includes('mva') || m.includes('med neg') || m.includes('raf')
            || m.includes('road accident') || m.includes('negligence') || m.includes('medico'),
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
          // Sent whenever no known profession was resolved from the quick
          // search box, so the edge function can still run a broad,
          // Google-style search on whatever was typed instead of refusing.
          query: filters.profession ? undefined : (filters.freeText || undefined),
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

  // Free text carried from the last quick search that didn't resolve to a
  // known profession, so toolbar controls (limit, trusted-only, source
  // toggles) can still re-run that search rather than going silent.
  const [lastFreeText, setLastFreeText] = useState('');

  const runExternalSearch = (overrides?: ExternalOverrides) => {
    if (!profession && !lastFreeText) {
      toast({ title: 'Nothing to search yet', description: 'Select a profession, or run a quick search first.', variant: 'destructive' });
      return;
    }
    setHasSearchedExternal(true);
    externalSearchMutation.mutate({ filters: { province, city, profession, freeText: lastFreeText }, overrides });
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
    setQuickQuery('');
    setLastParsedQuery(null);
    setLastFreeText('');
    setHasSearchedExternal(false);
    externalSearchMutation.reset();
    internalSearchMutation.mutate({ province: '', city: '', profession: '' });
  };

  /**
   * Runs a single free-text search — e.g. typing "neurosurgeon expert
   * witness" — across the platform directory AND every external directory
   * ("all platforms of experts"), the same way picking the dropdown filters
   * and pressing Search would, but from one box. Parses the profession
   * (ignoring boilerplate like "expert witness"), and province/city if
   * named, then runs the exact same internal + external queries.
   *
   * When the text doesn't resolve to a known profession (a typo we still
   * couldn't fuzzy-match, a specialty not in our list, a surname), the
   * search still runs — internally as a broad name/type/city match, and
   * externally as a raw, Google-style query — rather than refusing outright.
   */
  const runQuickSearch = (queryOverride?: string) => {
    const q = (queryOverride ?? quickQuery).trim();
    if (!q) return;

    const parsed = parseExpertQuery(q);
    setLastParsedQuery(parsed);
    setLastFreeText(parsed.profession ? '' : (parsed.freeText || q));

    if (!parsed.profession) {
      toast({
        title: 'Searching broadly',
        description: `Couldn't match "${q}" to a specific expert type — searching platform records and external directories for it as typed.`,
      });
      setProfession('');
      setProfessionQuery('');
      if (parsed.province) setProvince(parsed.province);
      setCity(parsed.city);

      const filters: SearchFilters = {
        profession: '', province: parsed.province, city: parsed.city,
        freeText: parsed.freeText || q,
      };
      internalSearchMutation.mutate(filters);
      setHasSearchedExternal(true);
      externalSearchMutation.mutate({ filters });
      return;
    }

    setProfession(parsed.profession);
    setProfessionQuery(parsed.profession);
    if (parsed.province) setProvince(parsed.province);
    setCity(parsed.city);

    const filters: SearchFilters = { profession: parsed.profession, province: parsed.province, city: parsed.city };
    internalSearchMutation.mutate(filters);
    setHasSearchedExternal(true);
    externalSearchMutation.mutate({ filters });
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

    // quick (free-text) search
    quickQuery, setQuickQuery,
    lastParsedQuery, lastFreeText,
    runQuickSearch,

    // actions
    runExternalSearch,
    handleSearch,
    handleReset,
    isSearching: internalSearchMutation.isPending || externalSearchMutation.isPending,
  };
};
