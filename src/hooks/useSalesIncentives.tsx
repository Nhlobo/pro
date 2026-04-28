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

const getSalesPayoutPeriod = () => {
  const now = new Date();
  const sastNow = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Johannesburg' }));
  const payoutAnchor = new Date(sastNow.getFullYear(), sastNow.getMonth(), 1);

  if (sastNow.getDate() >= 26) {
    payoutAnchor.setMonth(payoutAnchor.getMonth() + 1);
  }

  const payoutMonth = payoutAnchor.getMonth() + 1;
  const payoutYear = payoutAnchor.getFullYear();
  const periodStart = new Date(payoutYear, payoutMonth - 2, 26);
  const periodEnd = new Date(payoutYear, payoutMonth - 1, 25);
  const toISODate = (date: Date) => date.toISOString().split('T')[0];

  return {
    currentMonth: payoutMonth,
    currentYear: payoutYear,
    periodStart: toISODate(periodStart),
    periodEnd: toISODate(periodEnd),
  };
};

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

  const { currentMonth, currentYear, periodStart, periodEnd } = getSalesPayoutPeriod();

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
        const [perfRes, liveRes, strikeRes] = await Promise.all([
          supabase.from('monthly_performance').select('*').eq('consultant_id', c.id).order('year', { ascending: false }).order('month', { ascending: false }),
          supabase.rpc('get_consultant_period_stats', { p_start: periodStart, p_end: periodEnd }),
          supabase.from('consultant_strikes').select('*').eq('consultant_id', c.id).order('issued_date', { ascending: false }),
        ]);
        const storedPerf = (perfRes.data || []) as MonthlyPerformance[];
        const liveStats = (liveRes.data || []) as { consultant_id: string; raf_appts: number; medneg_appts: number; total_appts: number }[];
        const myLive = liveStats.find(l => l.consultant_id === c.id);

        // Overlay live appointment counts onto the current month's stored record
        if (myLive && Number(myLive.total_appts) > 0) {
          const currentStored = storedPerf.find(p => p.month === currentMonth && p.year === currentYear);
          const liveRecord: MonthlyPerformance = {
            id: currentStored?.id || c.id,
            consultant_id: c.id,
            month: currentMonth,
            year: currentYear,
            raf_appts: Number(myLive.raf_appts),
            medneg_appts: Number(myLive.medneg_appts),
            total_appts: Number(myLive.total_appts),
            raf_incentive_earned: currentStored?.raf_incentive_earned || 0,
            medneg_incentive_earned: currentStored?.medneg_incentive_earned || 0,
            incentive_earned: currentStored?.incentive_earned || 0,
            target_met: Number(myLive.total_appts) >= 7,
            warning_issued: currentStored?.warning_issued || false,
          };
          const otherMonths = storedPerf.filter(p => !(p.month === currentMonth && p.year === currentYear));
          setPerformance([liveRecord, ...otherMonths]);
        } else {
          setPerformance(storedPerf);
        }
        setStrikes(processStrikeExpiry((strikeRes.data || []) as ConsultantStrike[]));
      }
    } catch (err) {
      console.error('Error fetching sales data:', err);
    }
  }, [user?.id, currentMonth, currentYear, periodStart, periodEnd]);

  const fetchAllData = useCallback(async () => {
    try {
      const [cRes, pRes, liveRes, sRes, tRes] = await Promise.all([
        supabase.from('sales_consultants').select('*').eq('is_active', true),
        supabase.from('monthly_performance').select('*').eq('month', currentMonth).eq('year', currentYear),
        supabase.rpc('get_consultant_period_stats', { p_start: periodStart, p_end: periodEnd }),
        supabase.from('consultant_strikes').select('*').order('issued_date', { ascending: false }),
        supabase.from('incentive_tiers').select('*').order('min_appointments', { ascending: true }),
      ]);
      setAllConsultants((cRes.data || []) as SalesConsultant[]);

      // Merge live appointment counts from scheduled assessments with monthly_performance fallback
      const liveStats = (liveRes.data || []) as { consultant_id: string; raf_appts: number; medneg_appts: number; total_appts: number }[];
      const storedPerf = (pRes.data || []) as MonthlyPerformance[];
      const consultants = (cRes.data || []) as SalesConsultant[];

      const mergedPerformance: MonthlyPerformance[] = consultants.map(c => {
        const live = liveStats.find(l => l.consultant_id === c.id);
        const stored = storedPerf.find(p => p.consultant_id === c.id);
        const rafAppts = Number(live?.raf_appts || 0);
        const mednegAppts = Number(live?.medneg_appts || 0);
        const totalAppts = Number(live?.total_appts || 0);
        return {
          id: stored?.id || c.id,
          consultant_id: c.id,
          month: currentMonth,
          year: currentYear,
          raf_appts: totalAppts > 0 ? rafAppts : (stored?.raf_appts || 0),
          medneg_appts: totalAppts > 0 ? mednegAppts : (stored?.medneg_appts || 0),
          total_appts: totalAppts > 0 ? totalAppts : (stored?.total_appts || 0),
          raf_incentive_earned: stored?.raf_incentive_earned || 0,
          medneg_incentive_earned: stored?.medneg_incentive_earned || 0,
          incentive_earned: stored?.incentive_earned || 0,
          target_met: (totalAppts > 0 ? totalAppts : (stored?.total_appts || 0)) >= 7,
          warning_issued: stored?.warning_issued || false,
        };
      });

      setAllPerformance(mergedPerformance);
      setAllStrikes(processStrikeExpiry((sRes.data || []) as ConsultantStrike[]));
      setTiers((tRes.data || []) as IncentiveTier[]);
    } catch (err) {
      console.error('Error fetching all sales data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentMonth, currentYear, periodStart, periodEnd]);

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

  const calculateIncentive = (totalAppts: number, consultantType: 'internal' | 'external', rafAppts: number = 0, mednegAppts: number = 0) => {
    const tier = getActiveTier(totalAppts, consultantType);
    if (!tier) return { raf: 0, medneg: 0, total: 0, label: 'None', rafRate: 0, mednegRate: 0 };
    const rafEarnings = rafAppts * Number(tier.raf_amount);
    const mednegEarnings = mednegAppts * Number(tier.medneg_amount);
    return {
      raf: rafEarnings,
      medneg: mednegEarnings,
      total: rafEarnings + mednegEarnings,
      label: tier.label || '',
      rafRate: Number(tier.raf_amount),
      mednegRate: Number(tier.medneg_amount),
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
    periodStart,
    periodEnd,
    getActiveStrikes,
    getCurrentPerformance,
    getActiveTier,
    calculateIncentive,
    updateTier,
    refetch: () => { fetchMyData(); fetchAllData(); },
  };
};
