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

const MATTER_TYPE_NORMALIZE: Record<string, string> = {
  'raf': 'RAF',
  'mva': 'RAF',
  'road accident fund': 'RAF',
  'medical negligence': 'Medical Negligence',
  'medical_negligence': 'Medical Negligence',
  'merit report': 'Merit Report',
  'merit_report': 'Merit Report',
  'assault matter': 'Assault Matter',
  'assault_matter': 'Assault Matter',
  'slip and fall matter': 'Slip and Fall',
  'slip_and_fall_matter': 'Slip and Fall',
  'joint minutes': 'Joint Minutes',
  'joint_minutes': 'Joint Minutes',
  'addendum': 'Addendum',
  'affidavits': 'Affidavits',
  'court preparation': 'Court Preparation',
  'court_preparation': 'Court Preparation',
  'court attendance': 'Court Attendance',
  'court_attendance': 'Court Attendance',
};

function normalizeProvince(raw: string | null): string {
  if (!raw) return 'Unknown';
  const key = raw.trim().toLowerCase();
  return PROVINCE_NORMALIZE[key] || raw.trim();
}

function normalizeMatterType(raw: string | null): string {
  if (!raw) return 'Other';
  const key = raw.trim().toLowerCase();
  return MATTER_TYPE_NORMALIZE[key] || raw.trim();
}

export const useDashboardStats = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalClaimants: 0,
    totalAppointments: 0,
    pendingReports: 0,
    reportsInProgress: 0,
    reportsTakenOut: 0,
    completedAssessments: 0,
    provincialData: [],
    caseTypeData: [],
    overdueReports: 0,
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

      // Fetch pending reports count
      const { count: pendingCount } = await supabase
        .from('expert_reports')
        .select('*', { count: 'exact', head: true })
        .in('report_status', ['pending', 'not_received', 'under_review', 'Pending', 'Not Received']);

      // Fetch in progress reports count
      const { count: inProgressCount } = await supabase
        .from('expert_reports')
        .select('*', { count: 'exact', head: true })
        .in('report_status', ['in_progress', 'initial_stage', 'Initial Stage', 'Preparing Report', 'preparing_report', 'Report On Final Stage', 'report_on_final_stage']);

      // Fetch taken out reports count
      const { count: takenOutCount } = await supabase
        .from('expert_reports')
        .select('*', { count: 'exact', head: true })
        .in('report_status', ['taken_out', 'Taken Out', 'Report Submitted On AOD', 'report_submitted_on_aod', 'Report Submitted Without Full Payment', 'report_submitted_without_full_payment']);

      // Fetch completed assessments count
      const { count: completedCount } = await supabase
        .from('expert_reports')
        .select('*', { count: 'exact', head: true })
        .in('report_status', ['completed', 'Report fully paid & submitted', 'Report Fully Paid & Submitted', 'report_fully_paid_submitted', 'Report Submitted', 'report_submitted']);

      // Fetch provincial distribution from appointments joined with referring_attorneys
      const { data: appointmentsWithProvince } = await supabase
        .from('appointments')
        .select('referring_attorney_id, matter_type, referring_attorneys!appointments_referring_attorney_id_fkey(province)')
        .is('deleted_at', null);

      // Build provincial distribution
      const provinceCounts: Record<string, number> = {};
      const matterTypeCounts: Record<string, number> = {};

      (appointmentsWithProvince || []).forEach((apt: any) => {
        // Province
        const rawProvince = apt.referring_attorneys?.province;
        const province = normalizeProvince(rawProvince);
        provinceCounts[province] = (provinceCounts[province] || 0) + 1;

        // Matter type
        const matterType = normalizeMatterType(apt.matter_type);
        matterTypeCounts[matterType] = (matterTypeCounts[matterType] || 0) + 1;
      });

      const totalCases = Object.values(provinceCounts).reduce((s, c) => s + c, 0) || 1;
      const provincialData: ProvincialData[] = Object.entries(provinceCounts)
        .filter(([name]) => name !== 'Unknown')
        .map(([name, cases]) => ({
          name,
          cases,
          pct: Math.round((cases / totalCases) * 100),
        }))
        .sort((a, b) => b.cases - a.cases);

      const totalMatterCases = Object.values(matterTypeCounts).reduce((s, c) => s + c, 0) || 1;
      const caseTypeData: CaseTypeData[] = Object.entries(matterTypeCounts)
        .map(([type, count]) => ({
          type,
          count,
          pct: Math.round((count / totalMatterCases) * 100),
        }))
        .sort((a, b) => b.count - a.count);

      // Count overdue reports (pending/in_progress older than 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { count: overdueCount } = await supabase
        .from('expert_reports')
        .select('*', { count: 'exact', head: true })
        .in('report_status', ['pending', 'not_received', 'in_progress', 'initial_stage', 'Pending', 'Not Received', 'Initial Stage'])
        .lt('created_at', thirtyDaysAgo.toISOString());

      setStats({
        totalClaimants: claimantsCount || 0,
        totalAppointments: appointmentsCount || 0,
        pendingReports: pendingCount || 0,
        reportsInProgress: inProgressCount || 0,
        reportsTakenOut: takenOutCount || 0,
        completedAssessments: completedCount || 0,
        provincialData,
        caseTypeData,
        overdueReports: overdueCount || 0,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const initialFetchDone = useRef(false);
  
  useEffect(() => {
    if (!initialFetchDone.current) {
      fetchStats();
      initialFetchDone.current = true;
    } else if (isActiveTab && !isPageLocked) {
      fetchStats();
    }
  }, [lastUpdate, fetchStats, isActiveTab, isPageLocked]);

  useEffect(() => {
    const reportsChannel = supabase
      .channel('dashboard-reports-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expert_reports' }, () => {
        triggerSync();
      })
      .subscribe();

    const appointmentsChannel = supabase
      .channel('dashboard-appointments-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        triggerSync();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(reportsChannel);
      supabase.removeChannel(appointmentsChannel);
    };
  }, [triggerSync]);

  return { stats, loading, refetchStats: fetchStats };
};
