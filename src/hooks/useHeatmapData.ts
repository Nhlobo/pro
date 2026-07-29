import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SA_PROVINCES } from '@/hooks/useExpertSearch';

export type MatterCategory = 'raf' | 'med_neg' | 'both';

export type ProvinceStatus = 'critical' | 'shortage' | 'balanced' | 'inactive';

export interface ProvinceData {
  name: string;
  status: ProvinceStatus;
  /** Active experts registered in this province — "do we have such an expert". */
  experts: number;
  /** Of those experts, how many have actually been booked in the last 12 months — "have we used their service". */
  expertsUsed: number;
  /** Attorney-side demand originating from this province in the last 12 months. */
  demand: number;
  primaryExperts: number;
  expertsByType: Record<string, number>;
  /** Real business booked in the last 12 months, by matter type — not expert capability. */
  rafBusiness: number;
  medNegBusiness: number;
  bothBusiness: number;
  otherBusiness: number;
}

export const STATUS_META: Record<ProvinceStatus, { label: string; tone: 'neutral' | 'teal' | 'success' | 'warning' | 'destructive' }> = {
  critical: { label: 'Critical', tone: 'destructive' },
  shortage: { label: 'Shortage', tone: 'warning' },
  balanced: { label: 'Balanced', tone: 'success' },
  inactive: { label: 'Inactive', tone: 'neutral' },
};

/**
 * Every raw province spelling we've seen in the data (different casing,
 * underscores instead of spaces, abbreviations, typos) collapses to one
 * canonical SA_PROVINCES entry so a province never appears twice on the
 * heatmap.
 */
function sanitizeKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const PROVINCE_ALIASES: Record<string, string> = {
  'gauteng': 'Gauteng',
  'guateng': 'Gauteng',
  'western cape': 'Western Cape',
  'kwazulu natal': 'KwaZulu-Natal',
  'kzn': 'KwaZulu-Natal',
  'eastern cape': 'Eastern Cape',
  'free state': 'Free State',
  'mpumalanga': 'Mpumalanga',
  'limpopo': 'Limpopo',
  'north west': 'North West',
  'northern cape': 'Northern Cape',
};

// Also register every canonical name against itself (sanitized), so any
// minor spacing/casing/punctuation variant of a name we already know
// resolves correctly even if it isn't explicitly listed above.
SA_PROVINCES.forEach((name) => {
  PROVINCE_ALIASES[sanitizeKey(name)] = name;
});

function normalizeProvince(raw: string | null | undefined): string {
  if (!raw) return 'Unknown';
  const key = sanitizeKey(raw);
  if (!key) return 'Unknown';
  return PROVINCE_ALIASES[key] || raw.trim();
}

const PRIMARY_EXPERT_TYPES = ['Orthopaedic Surgeon', 'Neurosurgeon', 'Clinical Psychologist'];

/** Classifies a single appointment's matter_type into the business buckets shown on the card. */
function categorizeAppointmentMatter(matterType: string | null | undefined): MatterCategory | 'other' {
  const matter = (matterType || '').toLowerCase();
  const isRaf = matter.includes('raf') || matter.includes('road accident') || matter.includes('mva');
  const isMedNeg = matter.includes('negligence') || matter.includes('med_neg') || matter.includes('medneg');
  if (isRaf && isMedNeg) return 'both';
  if (isRaf) return 'raf';
  if (isMedNeg) return 'med_neg';
  return 'other';
}

function statusForProvince(experts: number, demand: number): ProvinceStatus {
  if (experts === 0 && demand === 0) return 'inactive';
  if (experts === 0) return 'critical';
  const ratio = experts / Math.max(demand, 1);
  if (ratio < 0.05) return 'critical';
  if (ratio < 0.15) return 'shortage';
  return 'balanced';
}

function emptyProvince(name: string): ProvinceData {
  return {
    name,
    status: 'inactive',
    experts: 0,
    expertsUsed: 0,
    demand: 0,
    primaryExperts: 0,
    expertsByType: {},
    rafBusiness: 0,
    medNegBusiness: 0,
    bothBusiness: 0,
    otherBusiness: 0,
  };
}

export const useHeatmapData = () => {
  const [provinces, setProvinces] = useState<ProvinceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const { data: experts, error: expertsError } = await supabase
        .from('medical_experts')
        .select('id, expert_type, province, status, medico_legal_only')
        .eq('status', 'active');
      if (expertsError) throw expertsError;

      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      const twelveMonthsAgoStr = twelveMonthsAgo.toISOString().slice(0, 10);

      const { data: appointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select('expert_id, matter_type, appointment_date, referring_attorneys!appointments_referring_attorney_id_fkey(province)')
        .is('deleted_at', null)
        .gte('appointment_date', twelveMonthsAgoStr);
      if (appointmentsError) throw appointmentsError;

      // Every expert_id that shows up on a real (non-deleted, last-12-months)
      // appointment — i.e. "have we actually used this expert's service".
      const usedExpertIds = new Set<string>((appointments || []).map((a: any) => a.expert_id).filter(Boolean));

      const byProvince: Record<string, ProvinceData> = {};
      SA_PROVINCES.forEach((name) => {
        byProvince[name] = emptyProvince(name);
      });

      (experts || []).forEach((e: any) => {
        if (e.medico_legal_only === false) return;
        const province = normalizeProvince(e.province);
        if (!byProvince[province]) byProvince[province] = emptyProvince(province);

        const entry = byProvince[province];
        entry.experts += 1;
        if (usedExpertIds.has(e.id)) entry.expertsUsed += 1;

        if (e.expert_type && PRIMARY_EXPERT_TYPES.includes(e.expert_type)) {
          entry.primaryExperts += 1;
        }

        const type = e.expert_type || 'Unspecified';
        entry.expertsByType[type] = (entry.expertsByType[type] || 0) + 1;
      });

      (appointments || []).forEach((apt: any) => {
        const rawProvince = apt.referring_attorneys?.province;
        const province = normalizeProvince(rawProvince);
        if (!byProvince[province]) byProvince[province] = emptyProvince(province);

        const entry = byProvince[province];
        entry.demand += 1;

        const category = categorizeAppointmentMatter(apt.matter_type);
        if (category === 'raf') entry.rafBusiness += 1;
        else if (category === 'med_neg') entry.medNegBusiness += 1;
        else if (category === 'both') entry.bothBusiness += 1;
        else entry.otherBusiness += 1;
      });

      const result = Object.values(byProvince).map((p) => ({
        ...p,
        status: statusForProvince(p.experts, p.demand),
      }));

      setProvinces(result);
    } catch (err) {
      console.error('Failed to load heatmap data', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(() => fetchData(true), [fetchData]);

  const totalExperts = provinces.reduce((sum, p) => sum + p.experts, 0);
  const totalExpertsUsed = provinces.reduce((sum, p) => sum + p.expertsUsed, 0);
  const totalDemand = provinces.reduce((sum, p) => sum + p.demand, 0);
  const criticalCount = provinces.filter((p) => p.status === 'critical').length;
  const balancedCount = provinces.filter((p) => p.status === 'balanced').length;

  const matterCounts: Record<'all' | MatterCategory, number> = {
    all: totalDemand,
    raf: provinces.reduce((sum, p) => sum + p.rafBusiness, 0),
    med_neg: provinces.reduce((sum, p) => sum + p.medNegBusiness, 0),
    both: provinces.reduce((sum, p) => sum + p.bothBusiness, 0),
  };

  return {
    provinces,
    loading,
    refreshing,
    refetch,
    totalExperts,
    totalExpertsUsed,
    totalDemand,
    criticalCount,
    balancedCount,
    matterCounts,
  };
};
