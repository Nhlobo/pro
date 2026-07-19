// src/hooks/useHeatmapData.tsx
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SA_PROVINCES } from '@/hooks/useExpertSearch';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type MatterCategory = 'raf' | 'med_neg' | 'both';

export type ProvinceStatus = 'critical' | 'shortage' | 'balanced' | 'inactive';

export interface ProvinceData {
  name: string;
  status: ProvinceStatus;
  experts: number;
  rafExperts: number;
  medNegExperts: number;
  bothExperts: number;
  demand: number;
  primaryExperts: number;
  expertsByType: Record<string, number>;
}

export const STATUS_META: Record<ProvinceStatus, { label: string; tone: 'neutral' | 'teal' | 'success' | 'warning' | 'destructive' }> = {
  critical: { label: 'Critical', tone: 'destructive' },
  shortage: { label: 'Shortage', tone: 'warning' },
  balanced: { label: 'Balanced', tone: 'success' },
  inactive: { label: 'Inactive', tone: 'neutral' },
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const PROVINCE_NORMALIZE: Record<string, string> = {
  'gauteng': 'Gauteng',
  'guateng': 'Gauteng',
  'western cape': 'Western Cape',
  'kwazulu-natal': 'KwaZulu-Natal',
  'kwazulu natal': 'KwaZulu-Natal',
  'kzn': 'KwaZulu-Natal',
  'eastern cape': 'Eastern Cape',
  'free state': 'Free State',
  'mpumalanga': 'Mpumalanga',
  'limpopo': 'Limpopo',
  'north west': 'North West',
  'northern cape': 'Northern Cape',
};

function normalizeProvince(raw: string | null | undefined): string {
  if (!raw) return 'Unknown';
  const key = raw.trim().toLowerCase();
  return PROVINCE_NORMALIZE[key] || raw.trim();
}

// Experts whose type covers the three "gatekeeper" specialities that most
// RAF/med-neg matters need a report from first.
const PRIMARY_EXPERT_TYPES = ['Orthopaedic Surgeon', 'Neurosurgeon', 'Clinical Psychologist'];

function categorizeMatters(matterTypes: string[] | null): MatterCategory {
  const matters = (matterTypes || []).map((m) => m.toLowerCase());
  const isRaf = matters.some((m) => m.includes('raf') || m.includes('road accident') || m.includes('mva'));
  const isMedNeg = matters.some((m) => m.includes('negligence') || m.includes('med_neg') || m.includes('medneg'));
  if (isRaf && isMedNeg) return 'both';
  if (isRaf) return 'raf';
  if (isMedNeg) return 'med_neg';
  // Experts without explicit matter tagging are treated as generalists
  // available to both matter types.
  return 'both';
}

function statusForProvince(experts: number, demand: number): ProvinceStatus {
  if (experts === 0 && demand === 0) return 'inactive';
  if (experts === 0) return 'critical';
  const ratio = experts / Math.max(demand, 1);
  if (ratio < 0.05) return 'critical';
  if (ratio < 0.15) return 'shortage';
  return 'balanced';
}

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

/**
 * Availability heatmap data layer.
 *
 * Pulls active `medical_experts` (grouped by province, expert type, and
 * RAF/med-neg/both matter coverage) alongside the last 12 months of
 * `appointments` (grouped by the referring attorney's province) to work
 * out expert-supply-vs-demand per province, matching the thresholds the
 * Availability Heatmap page expects.
 */
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
        .select('id, expert_type, province, matter_types, status, medico_legal_only')
        .eq('status', 'active');
      if (expertsError) throw expertsError;

      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      const twelveMonthsAgoStr = twelveMonthsAgo.toISOString().slice(0, 10);

      const { data: appointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select('appointment_date, referring_attorneys!appointments_referring_attorney_id_fkey(province)')
        .is('deleted_at', null)
        .gte('appointment_date', twelveMonthsAgoStr);
      if (appointmentsError) throw appointmentsError;

      const byProvince: Record<string, ProvinceData> = {};
      SA_PROVINCES.forEach((name) => {
        byProvince[name] = {
          name,
          status: 'inactive',
          experts: 0,
          rafExperts: 0,
          medNegExperts: 0,
          bothExperts: 0,
          demand: 0,
          primaryExperts: 0,
          expertsByType: {},
        };
      });

      (experts || []).forEach((e: any) => {
        if (e.medico_legal_only === false) return;
        const province = normalizeProvince(e.province);
        if (!byProvince[province]) {
          byProvince[province] = {
            name: province,
            status: 'inactive',
            experts: 0,
            rafExperts: 0,
            medNegExperts: 0,
            bothExperts: 0,
            demand: 0,
            primaryExperts: 0,
            expertsByType: {},
          };
        }
        const entry = byProvince[province];
        entry.experts += 1;

        const category = categorizeMatters(e.matter_types);
        if (category === 'raf') entry.rafExperts += 1;
        else if (category === 'med_neg') entry.medNegExperts += 1;
        else entry.bothExperts += 1;

        if (e.expert_type && PRIMARY_EXPERT_TYPES.includes(e.expert_type)) {
          entry.primaryExperts += 1;
        }

        const type = e.expert_type || 'Unspecified';
        entry.expertsByType[type] = (entry.expertsByType[type] || 0) + 1;
      });

      (appointments || []).forEach((apt: any) => {
        const rawProvince = apt.referring_attorneys?.province;
        const province = normalizeProvince(rawProvince);
        if (!byProvince[province]) {
          byProvince[province] = {
            name: province,
            status: 'inactive',
            experts: 0,
            rafExperts: 0,
            medNegExperts: 0,
            bothExperts: 0,
            demand: 0,
            primaryExperts: 0,
            expertsByType: {},
          };
        }
        byProvince[province].demand += 1;
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
  const totalDemand = provinces.reduce((sum, p) => sum + p.demand, 0);
  const criticalCount = provinces.filter((p) => p.status === 'critical').length;
  const balancedCount = provinces.filter((p) => p.status === 'balanced').length;

  const matterCounts: Record<'all' | MatterCategory, number> = {
    all: totalExperts,
    raf: provinces.reduce((sum, p) => sum + p.rafExperts, 0),
    med_neg: provinces.reduce((sum, p) => sum + p.medNegExperts, 0),
    both: provinces.reduce((sum, p) => sum + p.bothExperts, 0),
  };

  return {
    provinces,
    loading,
    refreshing,
    refetch,
    totalExperts,
    totalDemand,
    criticalCount,
    balancedCount,
    matterCounts,
  };
};
