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

export const useTeamTargets = () => {
  const [targets, setTargets] = useState<TeamTarget[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const currentQuarter = Math.ceil(currentMonth / 3);

  const fetchTargets = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('sales_team_targets')
        .select('*')
        .eq('period_year', currentYear)
        .eq('is_active', true)
        .order('period_type', { ascending: true });

      if (error) throw error;
      setTargets((data || []) as TeamTarget[]);
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
      // Build query to find existing record (NULL-safe matching)
      let query = supabase
        .from('sales_team_targets')
        .select('id')
        .eq('period_type', periodType)
        .eq('period_year', currentYear);

      if (opts?.month) {
        query = query.eq('period_month', opts.month);
      } else {
        query = query.is('period_month', null);
      }

      if (opts?.quarter) {
        query = query.eq('period_quarter', opts.quarter);
      } else {
        query = query.is('period_quarter', null);
      }

      const { data: existing } = await query.maybeSingle();

      let error;
      if (existing?.id) {
        // Update existing record
        const res = await supabase
          .from('sales_team_targets')
          .update({
            team_target: teamTarget,
            is_active: true,
            notes: opts?.notes || null,
          })
          .eq('id', existing.id);
        error = res.error;
      } else {
        // Insert new record
        const res = await supabase
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
        error = res.error;
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
