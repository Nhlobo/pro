import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

function statusForProvince(experts: number, demand: number): ProvinceStatus {
  if (experts === 0 && demand === 0) return 'inactive';
  if (experts === 0) return 'critical';
  const ratio = experts / Math.max(demand, 1);
  if (ratio < 0.05) return 'critical';
  if (ratio < 0.15) return 'shortage';
  return 'balanced';
}

interface HeatmapRpcRow {
  province: string;
  experts: number;
  experts_used: number;
  primary_experts: number;
  demand: number;
  raf_business: number;
  med_neg_business: number;
  both_business: number;
  other_business: number;
}

export const useHeatmapData = () => {
  const [provinces, setProvinces] = useState<ProvinceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      // Aggregation now happens in Postgres (see
      // get_heatmap_province_stats migration) instead of pulling every
      // expert/appointment row to the browser. This keeps the page fast
      // and correct as data grows, and guarantees every consumer of
      // this number (dashboard, reports, this page) reads the same
      // 12-month window computed the same way.
      const { data, error: rpcError } = await supabase.rpc('get_heatmap_province_stats');
      if (rpcError) throw rpcError;

      const rows = (data || []) as HeatmapRpcRow[];
      const result: ProvinceData[] = rows.map((r) => ({
        name: r.province,
        status: statusForProvince(r.experts, r.demand),
        experts: r.experts,
        expertsUsed: r.experts_used,
        demand: r.demand,
        primaryExperts: r.primary_experts,
        rafBusiness: r.raf_business,
        medNegBusiness: r.med_neg_business,
        bothBusiness: r.both_business,
        otherBusiness: r.other_business,
      }));

      setProvinces(result);
      setLastSyncedAt(new Date());
    } catch (err) {
      console.error('Failed to load heatmap data', err);
      setError(err instanceof Error ? err.message : 'Failed to load heatmap data');
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

  // Directly answers "which province is giving us more business" —
  // ranked by real 12-month demand, highest first.
  const topByBusiness = [...provinces]
    .filter((p) => p.demand > 0)
    .sort((a, b) => b.demand - a.demand);

  // Directly answers "where is there demand but no/low expert coverage" —
  // the gap list the client asked for, ranked by severity of the gap.
  const expertGaps = [...provinces]
    .filter((p) => p.demand > 0 && (p.status === 'critical' || p.status === 'shortage'))
    .sort((a, b) => {
      const ratioA = a.experts / Math.max(a.demand, 1);
      const ratioB = b.experts / Math.max(b.demand, 1);
      return ratioA - ratioB;
    });

  return {
    provinces,
    loading,
    refreshing,
    error,
    lastSyncedAt,
    refetch,
    totalExperts,
    totalExpertsUsed,
    totalDemand,
    criticalCount,
    balancedCount,
    matterCounts,
    topByBusiness,
    expertGaps,
  };
};
