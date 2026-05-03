import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TeamTarget {
  id: string;
  period_type: 'monthly' | 'quarterly' | 'yearly';
  period_month: number | null;
  period_quarter: number | null;
  period_year: number;
  team_target: number;
  is_active: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const useTeamTargets = (yearOverride?: number) => {
  const [targets, setTargets] = useState<TeamTarget[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = yearOverride ?? now.getFullYear();
  const currentQuarter = Math.ceil(currentMonth / 3);

  const fetchTargets = useCallback(async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('sales_team_targets')
        .select('*')
        .eq('period_year', currentYear)
        .eq('is_active', true)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const latestByPeriod = new Map<string, TeamTarget>();
      ((data || []) as TeamTarget[]).forEach((target) => {
        const key = [
          target.period_type,
          target.period_year,
          target.period_month ?? 'none',
          target.period_quarter ?? 'none',
        ].join('-');

        if (!latestByPeriod.has(key)) {
          latestByPeriod.set(key, target);
        }
      });

      setTargets(Array.from(latestByPeriod.values()));
    } catch (err) {
      console.error('Error fetching team targets:', err);
    } finally {
      setLoading(false);
    }
  }, [currentYear]);

  const upsertTarget = async (
    periodType: 'monthly' | 'quarterly' | 'yearly',
    teamTarget: number,
    opts?: { month?: number; quarter?: number; notes?: string }
  ) => {
    try {
      let query = supabase
        .from('sales_team_targets')
        .select('id, updated_at')
        .eq('period_type', periodType)
        .eq('period_year', currentYear);

      if (typeof opts?.month === 'number') {
        query = query.eq('period_month', opts.month);
      } else {
        query = query.is('period_month', null);
      }

      if (typeof opts?.quarter === 'number') {
        query = query.eq('period_quarter', opts.quarter);
      } else {
        query = query.is('period_quarter', null);
      }

      const { data: existingRows, error: existingError } = await query.order('updated_at', { ascending: false });

      if (existingError) throw existingError;

      let error = null;

      if ((existingRows?.length || 0) > 0) {
        const { error: updateError } = await supabase
          .from('sales_team_targets')
          .update({
            team_target: teamTarget,
            is_active: true,
            notes: opts?.notes || null,
          })
          .in('id', existingRows!.map((row) => row.id));

        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('sales_team_targets')
          .insert({
            period_type: periodType,
            period_year: currentYear,
            team_target: teamTarget,
            is_active: true,
            notes: opts?.notes || null,
            period_month: opts?.month || null,
            period_quarter: opts?.quarter || null,
          });

        error = insertError;
      }

      if (!error) {
        await fetchTargets();
      }

      return { error };
    } catch (err) {
      console.error('Error upserting target:', err);
      return { error: err };
    }
  };

  const getCurrentTarget = (periodType: 'monthly' | 'quarterly' | 'yearly'): TeamTarget | undefined => {
    if (periodType === 'monthly') {
      return targets.find(t => t.period_type === 'monthly' && t.period_month === currentMonth);
    }
    if (periodType === 'quarterly') {
      return targets.find(t => t.period_type === 'quarterly' && t.period_quarter === currentQuarter);
    }
    return targets.find(t => t.period_type === 'yearly');
  };

  useEffect(() => {
    fetchTargets();
  }, [fetchTargets]);

  return {
    targets,
    loading,
    currentMonth,
    currentYear,
    currentQuarter,
    upsertTarget,
    getCurrentTarget,
    refetch: fetchTargets,
  };
};
