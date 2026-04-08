import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface SalesConsultant {
  id: string;
  user_id: string;
  name: string;
  type: 'internal' | 'external';
  region: string | null;
  is_active: boolean;
}

export interface MonthlyPerformance {
  id: string;
  consultant_id: string;
  month: number;
  year: number;
  raf_appts: number;
  medneg_appts: number;
  total_appts: number;
  raf_incentive_earned: number;
  medneg_incentive_earned: number;
  incentive_earned: number;
  target_met: boolean;
  warning_issued: boolean;
}

export interface ConsultantStrike {
  id: string;
  consultant_id: string;
  issued_date: string;
  expiry_date: string;
  type: 'verbal' | 'written' | 'dismissal';
  reason: string | null;
  expired: boolean;
}

export interface IncentiveTier {
  id: string;
  tier_type: 'internal' | 'external';
  min_appointments: number;
  max_appointments: number | null;
  raf_amount: number;
  medneg_amount: number;
  label: string | null;
}

export const useSalesIncentives = () => {
  const { user } = useAuth();
  const [consultant, setConsultant] = useState<SalesConsultant | null>(null);
  const [performance, setPerformance] = useState<MonthlyPerformance[]>([]);
  const [strikes, setStrikes] = useState<ConsultantStrike[]>([]);
  const [tiers, setTiers] = useState<IncentiveTier[]>([]);
  const [allConsultants, setAllConsultants] = useState<SalesConsultant[]>([]);
  const [allPerformance, setAllPerformance] = useState<MonthlyPerformance[]>([]);
  const [allStrikes, setAllStrikes] = useState<ConsultantStrike[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const fetchMyData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data: c } = await supabase
        .from('sales_consultants')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (c) {
        setConsultant(c as SalesConsultant);
        const [perfRes, strikeRes] = await Promise.all([
          supabase.from('monthly_performance').select('*').eq('consultant_id', c.id).order('year', { ascending: false }).order('month', { ascending: false }),
          supabase.from('consultant_strikes').select('*').eq('consultant_id', c.id).order('issued_date', { ascending: false }),
        ]);
        setPerformance((perfRes.data || []) as MonthlyPerformance[]);
        setStrikes(processStrikeExpiry((strikeRes.data || []) as ConsultantStrike[]));
      }
    } catch (err) {
      console.error('Error fetching sales data:', err);
    }
  }, [user?.id]);

  const fetchAllData = useCallback(async () => {
    try {
      const [cRes, pRes, sRes, tRes] = await Promise.all([
        supabase.from('sales_consultants').select('*').eq('is_active', true),
        supabase.from('monthly_performance').select('*').eq('month', currentMonth).eq('year', currentYear),
        supabase.from('consultant_strikes').select('*').order('issued_date', { ascending: false }),
        supabase.from('incentive_tiers').select('*').order('min_appointments', { ascending: true }),
      ]);
      setAllConsultants((cRes.data || []) as SalesConsultant[]);
      setAllPerformance((pRes.data || []) as MonthlyPerformance[]);
      setAllStrikes(processStrikeExpiry((sRes.data || []) as ConsultantStrike[]));
      setTiers((tRes.data || []) as IncentiveTier[]);
    } catch (err) {
      console.error('Error fetching all sales data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentMonth, currentYear]);

  const processStrikeExpiry = (strikesData: ConsultantStrike[]): ConsultantStrike[] => {
    const today = new Date().toISOString().split('T')[0];
    return strikesData.map(s => ({
      ...s,
      expired: s.expired || s.expiry_date < today,
    }));
  };

  const getActiveStrikes = (consultantId: string) => {
    const all = (allStrikes.length > 0 ? allStrikes : strikes).filter(
      s => s.consultant_id === consultantId && !s.expired
    );
    return all;
  };

  const getCurrentPerformance = (consultantId: string): MonthlyPerformance | undefined => {
    const source = allPerformance.length > 0 ? allPerformance : performance;
    return source.find(p => p.consultant_id === consultantId && p.month === currentMonth && p.year === currentYear);
  };

  const getActiveTier = (totalAppts: number, consultantType: 'internal' | 'external'): IncentiveTier | undefined => {
    return tiers
      .filter(t => t.tier_type === consultantType)
      .find(t => totalAppts >= t.min_appointments && (t.max_appointments === null || totalAppts <= t.max_appointments));
  };

  const calculateIncentive = (totalAppts: number, consultantType: 'internal' | 'external') => {
    const tier = getActiveTier(totalAppts, consultantType);
    if (!tier) return { raf: 0, medneg: 0, total: 0, label: 'None' };
    return {
      raf: Number(tier.raf_amount),
      medneg: Number(tier.medneg_amount),
      total: Number(tier.raf_amount) + Number(tier.medneg_amount),
      label: tier.label || '',
    };
  };

  const updateTier = async (tierId: string, updates: Partial<IncentiveTier>) => {
    // Optimistic update for immediate UI feedback
    setTiers(prev => prev.map(t => t.id === tierId ? { ...t, ...updates } as IncentiveTier : t));
    const { error } = await supabase
      .from('incentive_tiers')
      .update(updates)
      .eq('id', tierId);
    if (error) {
      // Revert on failure
      fetchAllData();
    }
    return { error };
  };

  useEffect(() => {
    fetchMyData();
    fetchAllData();
  }, [fetchMyData, fetchAllData]);

  return {
    consultant,
    performance,
    strikes,
    tiers,
    allConsultants,
    allPerformance,
    allStrikes,
    loading,
    currentMonth,
    currentYear,
    getActiveStrikes,
    getCurrentPerformance,
    getActiveTier,
    calculateIncentive,
    updateTier,
    refetch: () => { fetchMyData(); fetchAllData(); },
  };
};
