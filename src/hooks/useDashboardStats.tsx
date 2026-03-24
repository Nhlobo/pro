import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAppointmentSync } from '@/contexts/AppointmentSyncContext';

export interface ProvincialData {
  name: string;
  cases: number;
  pct: number;
}

export interface CaseTypeData {
  type: string;
  count: number;
  pct: number;
}

export interface DashboardStats {
  totalClaimants: number;
  totalAppointments: number;
  pendingReports: number;
  reportsInProgress: number;
  reportsTakenOut: number;
  completedAssessments: number;
  provincialData: ProvincialData[];
  caseTypeData: CaseTypeData[];
  overdueReports: number;
}

export const useDashboardStats = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalClaimants: 0,
    totalAppointments: 0,
    pendingReports: 0,
    reportsInProgress: 0,
    reportsTakenOut: 0,
    completedAssessments: 0,
  });
  const [loading, setLoading] = useState(true);
  const { lastUpdate, triggerSync, isActiveTab, isPageLocked } = useAppointmentSync();

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch claimants count
      const { count: claimantsCount } = await supabase
        .from('claimants')
        .select('*', { count: 'exact', head: true });

      // Fetch appointments count (excluding deleted)
      const { count: appointmentsCount } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null);

      // Fetch pending reports count (excludes Initial Stage which is now In Progress)
      const { count: pendingCount } = await supabase
        .from('expert_reports')
        .select('*', { count: 'exact', head: true })
        .in('report_status', ['pending', 'not_received', 'under_review', 'Pending', 'Not Received']);

      // Fetch in progress reports count (includes Initial Stage and Preparing Report)
      const { count: inProgressCount } = await supabase
        .from('expert_reports')
        .select('*', { count: 'exact', head: true })
        .in('report_status', ['in_progress', 'initial_stage', 'Initial Stage', 'Preparing Report', 'preparing_report', 'Report On Final Stage', 'report_on_final_stage']);

      // Fetch taken out reports count (includes both formats)
      const { count: takenOutCount } = await supabase
        .from('expert_reports')
        .select('*', { count: 'exact', head: true })
        .in('report_status', ['taken_out', 'Taken Out', 'Report Submitted On AOD', 'report_submitted_on_aod', 'Report Submitted Without Full Payment', 'report_submitted_without_full_payment']);

      // Fetch completed assessments count (includes Report Submitted)
      const { count: completedCount } = await supabase
        .from('expert_reports')
        .select('*', { count: 'exact', head: true })
        .in('report_status', ['completed', 'Report fully paid & submitted', 'Report Fully Paid & Submitted', 'report_fully_paid_submitted', 'Report Submitted', 'report_submitted']);

      setStats({
        totalClaimants: claimantsCount || 0,
        totalAppointments: appointmentsCount || 0,
        pendingReports: pendingCount || 0,
        reportsInProgress: inProgressCount || 0,
        reportsTakenOut: takenOutCount || 0,
        completedAssessments: completedCount || 0,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Always fetch on initial mount, then respect sync conditions for subsequent updates
  const initialFetchDone = useRef(false);
  
  useEffect(() => {
    if (!initialFetchDone.current) {
      fetchStats();
      initialFetchDone.current = true;
    } else if (isActiveTab && !isPageLocked) {
      fetchStats();
    }
  }, [lastUpdate, fetchStats, isActiveTab, isPageLocked]);

  // Subscribe to real-time changes on expert_reports and appointments
  useEffect(() => {
    const reportsChannel = supabase
      .channel('dashboard-reports-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'expert_reports'
        },
        () => {
          console.log('Expert reports changed, refreshing dashboard stats...');
          triggerSync();
        }
      )
      .subscribe();

    const appointmentsChannel = supabase
      .channel('dashboard-appointments-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments'
        },
        () => {
          console.log('Appointments changed, refreshing dashboard stats...');
          triggerSync();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(reportsChannel);
      supabase.removeChannel(appointmentsChannel);
    };
  }, [triggerSync]);

  return { stats, loading, refetchStats: fetchStats };
};
