import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAppointmentSync } from '@/contexts/AppointmentSyncContext';

export interface DashboardStats {
  totalClaimants: number;
  totalAppointments: number;
  pendingReports: number;
  reportsInProgress: number;
  reportsTakenOut: number;
  completedAssessments: number;
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
  const { lastUpdate } = useAppointmentSync();

  useEffect(() => {
    const fetchStats = async () => {
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

        // Fetch pending reports count
        const { count: pendingCount } = await supabase
          .from('expert_reports')
          .select('*', { count: 'exact', head: true })
          .eq('report_status', 'pending');

        // Fetch in progress reports count
        const { count: inProgressCount } = await supabase
          .from('expert_reports')
          .select('*', { count: 'exact', head: true })
          .eq('report_status', 'in_progress');

        // Fetch taken out reports count
        const { count: takenOutCount } = await supabase
          .from('expert_reports')
          .select('*', { count: 'exact', head: true })
          .eq('report_status', 'taken_out');

        // Fetch completed assessments count
        const { count: completedCount } = await supabase
          .from('expert_reports')
          .select('*', { count: 'exact', head: true })
          .eq('report_status', 'completed');

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
    };

    fetchStats();
  }, [lastUpdate]);

  return { stats, loading };
};
