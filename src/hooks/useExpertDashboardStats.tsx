import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAppointmentSync } from '@/contexts/AppointmentSyncContext';
import { differenceInDays, parseISO } from 'date-fns';

// Mirrors useAttorneyDashboardStats.tsx: same page-lock-aware live sync
// (AppointmentSyncContext) instead of the Expert Dashboard's previous
// one-shot `useEffect` fetch with no refresh path at all. Referring
// attorneys see their numbers update automatically when data changes
// elsewhere; experts previously had to hard-refresh the page to see
// anything new — that gap is what "fast sync" was missing.

export interface ExpertDashboardStats {
  upcomingAppointments: number;
  pendingReports: number;
  overdueReports: number;
  completedAssessments: number;
  totalCases: number;
  averageDays: number;
  outstandingDebt: number;
}

const EMPTY_STATS: ExpertDashboardStats = {
  upcomingAppointments: 0,
  pendingReports: 0,
  overdueReports: 0,
  completedAssessments: 0,
  totalCases: 0,
  averageDays: 0,
  outstandingDebt: 0,
};

export const useExpertDashboardStats = () => {
  const { user } = useAuth();
  const { lastUpdate, isActiveTab, isPageLocked } = useAppointmentSync();

  const [expertId, setExpertId] = useState<string | null>(null);
  const [expertName, setExpertName] = useState('');
  const [loading, setLoading] = useState(true);
  const [notLinked, setNotLinked] = useState(false);
  const [stats, setStats] = useState<ExpertDashboardStats>(EMPTY_STATS);
  const [upcomingCases, setUpcomingCases] = useState<any[]>([]);
  const [overdueReports, setOverdueReportsList] = useState<any[]>([]);
  const [pendingReportsList, setPendingReportsList] = useState<any[]>([]);
  const [recentlyCompleted, setRecentlyCompleted] = useState<any[]>([]);

  const fetchStats = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Single joined lookup instead of a profile round trip followed by
      // a separate medical_experts round trip — one network hop, not two,
      // before any of the real dashboard data can start loading.
      const { data: profile } = await supabase
        .from('profiles')
        .select('expert_id, medical_experts:expert_id(first_name, last_name)')
        .eq('id', user.id)
        .single();

      const linkedExpertId = profile?.expert_id || null;
      setExpertId(linkedExpertId);

      if (!linkedExpertId) {
        setNotLinked(true);
        setLoading(false);
        return;
      }

      const expert = Array.isArray(profile?.medical_experts) ? profile?.medical_experts[0] : profile?.medical_experts;
      if (expert) setExpertName(`${expert.first_name} ${expert.last_name}`);

      const [apptsRes, reportsRes, debtsRes] = await Promise.all([
        supabase
          .from('external_portal_cases' as any)
          .select(`appointment_id, appointment_date, claimant_first_name, claimant_last_name, claimant_auto_id, referring_attorney_name, expert_practice_address`)
          .eq('expert_id', linkedExpertId)
          .is('deleted_at', null)
          .order('appointment_date', { ascending: true }),
        supabase
          .from('expert_reports')
          .select('*')
          .eq('expert_id', linkedExpertId),
        supabase
          .from('expert_payments')
          .select('payment_amount')
          .eq('expert_id', linkedExpertId),
      ]);

      // Previously these three results were used purely as `.data || []`
      // with their `.error` fields never inspected — an RLS denial (e.g.
      // the appointments/expert_reports policies not yet granting expert
      // access) looks identical to "this expert genuinely has 0 cases":
      // both return an empty array with no visible error, which is why
      // every card on this dashboard reads 0 with nothing in the UI or
      // console to tell you why. Logging it here doesn't change what the
      // dashboard shows (the cards should still degrade to 0, not throw,
      // if a real expert genuinely has no data yet) — it just makes an
      // actual permissions failure loud instead of silent.
      if (apptsRes.error) console.error('[useExpertDashboardStats] appointments query failed', apptsRes.error);
      if (reportsRes.error) console.error('[useExpertDashboardStats] expert_reports query failed', reportsRes.error);
      if (debtsRes.error) console.error('[useExpertDashboardStats] expert_payments query failed', debtsRes.error);

      const now = new Date();
      const allAppts = ((apptsRes.data || []) as any[]).map(a => ({
        id: a.appointment_id,
        appointment_date: a.appointment_date,
        claimants: { first_name: a.claimant_first_name, last_name: a.claimant_last_name, auto_id: a.claimant_auto_id },
        referring_attorneys: { name: a.referring_attorney_name },
        medical_experts: { practice_address: a.expert_practice_address },
      }));
      const allReports = reportsRes.data || [];

      const payments = debtsRes.data || [];
      const totalDebt = payments.reduce((sum, d) => sum + (d.payment_amount || 0), 0);

      const upcoming = allAppts.filter((a) => new Date(a.appointment_date) >= now);
      const pending = allReports.filter((r) => r.report_status !== 'completed' && r.report_status !== 'taken_out');
      const overdue = allReports.filter((r) => {
        if (!r.report_due_date || r.report_status === 'completed' || r.report_status === 'taken_out') return false;
        return differenceInDays(parseISO(r.report_due_date), now) < 0;
      });
      const completed = allReports.filter((r) => r.report_status === 'completed' || r.report_status === 'taken_out');
      const withDays = completed.filter((r) => r.days_to_complete != null);
      const avgDays = withDays.length > 0
        ? Math.round(withDays.reduce((s, r) => s + (r.days_to_complete || 0), 0) / withDays.length)
        : 0;

      setStats({
        upcomingAppointments: upcoming.length,
        pendingReports: pending.length,
        overdueReports: overdue.length,
        completedAssessments: completed.length,
        totalCases: allAppts.length,
        averageDays: avgDays,
        outstandingDebt: totalDebt > 0 ? totalDebt : 0,
      });

      setUpcomingCases(
        upcoming.slice(0, 5).map((a) => ({ ...a, report: allReports.find((r) => r.appointment_id === a.id) }))
      );
      setOverdueReportsList(
        overdue.slice(0, 5).map((r) => ({ ...r, appointment: allAppts.find((a) => a.id === r.appointment_id) }))
      );
      setPendingReportsList(
        pending
          .filter((r) => !overdue.includes(r))
          .slice(0, 5)
          .map((r) => ({ ...r, appointment: allAppts.find((a) => a.id === r.appointment_id) }))
      );
      setRecentlyCompleted(
        [...completed]
          .sort((a, b) => new Date(b.report_submitted_date || b.updated_at).getTime() - new Date(a.report_submitted_date || a.updated_at).getTime())
          .slice(0, 5)
          .map((r) => ({ ...r, appointment: allAppts.find((a) => a.id === r.appointment_id) }))
      );
    } catch (error) {
      console.error('Error fetching expert dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Same pattern as the attorney dashboard: always fetch once on mount,
  // then only auto-refresh while this tab is active and the page isn't
  // locked (the user isn't mid-interaction with a form on the page).
  const initialFetchDone = useRef(false);
  useEffect(() => {
    if (!user) return;
    if (!initialFetchDone.current) {
      fetchStats();
      initialFetchDone.current = true;
    } else if (isActiveTab && !isPageLocked) {
      fetchStats();
    }
  }, [user, lastUpdate, fetchStats, isActiveTab, isPageLocked]);

  return {
    expertId,
    expertName,
    notLinked,
    stats,
    upcomingCases,
    overdueReports,
    pendingReportsList,
    recentlyCompleted,
    loading,
    refetchStats: fetchStats,
  };
};
