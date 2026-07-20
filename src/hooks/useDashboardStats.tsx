import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAppointmentSync } from '@/contexts/AppointmentSyncContext';

export interface ProvincialData {
  name: string;
  cases: number;
  pct: number;
  casesLastYear: number;
  pctLastYear: number;
}

export interface CaseTypeData {
  type: string;
  count: number;
  pct: number;
  countLastYear: number;
  pctLastYear: number;
}

/** Per-province breakdown by resolution status, feeding the map pins on the operations dashboard. */
export interface ProvinceStatusData {
  name: string;
  resolved: number;
  inProgress: number;
  pending: number;
  total: number;
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
  provinceStatusData: ProvinceStatusData[];
  overdueReports: number;
  // Prior year comparisons
  totalAppointmentsLastYear: number;
  pendingReportsLastYear: number;
  reportsInProgressLastYear: number;
  reportsTakenOutLastYear: number;
  completedAssessmentsLastYear: number;
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

// Shared status buckets — used for both the KPI counts above and the
// per-province map breakdown below, so the two never drift apart.
const PENDING_STATUSES = ['pending', 'not_received', 'under_review', 'Pending', 'Not Received'];
const IN_PROGRESS_STATUSES = [
  'in_progress', 'initial_stage', 'Initial Stage', 'Preparing Report', 'preparing_report',
  'Report On Final Stage', 'report_on_final_stage',
  'taken_out', 'Taken Out', 'Report Submitted On AOD', 'report_submitted_on_aod',
  'Report Submitted Without Full Payment', 'report_submitted_without_full_payment',
];
const RESOLVED_STATUSES = [
  'completed', 'Report fully paid & submitted', 'Report Fully Paid & Submitted',
  'report_fully_paid_submitted', 'Report Submitted', 'report_submitted',
];

function statusBucket(status: string): 'pending' | 'inProgress' | 'resolved' | null {
  if (PENDING_STATUSES.includes(status)) return 'pending';
  if (IN_PROGRESS_STATUSES.includes(status)) return 'inProgress';
  if (RESOLVED_STATUSES.includes(status)) return 'resolved';
  return null;
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
    provinceStatusData: [],
    overdueReports: 0,
    totalAppointmentsLastYear: 0,
    pendingReportsLastYear: 0,
    reportsInProgressLastYear: 0,
    reportsTakenOutLastYear: 0,
    completedAssessmentsLastYear: 0,
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

      const currentYear = new Date().getFullYear();
      const lastYear = currentYear - 1;
      const currentYearStart = `${currentYear}-01-01`;
      const lastYearStart = `${lastYear}-01-01`;
      const lastYearEnd = `${lastYear}-12-31T23:59:59`;

      // Fetch current year appointments with province
      const { data: currentYearAppts } = await supabase
        .from('appointments')
        .select('referring_attorney_id, matter_type, appointment_date, referring_attorneys!appointments_referring_attorney_id_fkey(province)')
        .is('deleted_at', null)
        .gte('appointment_date', currentYearStart);

      // Fetch last year appointments with province
      const { data: lastYearAppts } = await supabase
        .from('appointments')
        .select('referring_attorney_id, matter_type, appointment_date, referring_attorneys!appointments_referring_attorney_id_fkey(province)')
        .is('deleted_at', null)
        .gte('appointment_date', lastYearStart)
        .lte('appointment_date', lastYearEnd);

      // Build provincial distribution for current year
      const provinceCounts: Record<string, number> = {};
      const provinceCountsLastYear: Record<string, number> = {};
      const matterTypeCounts: Record<string, number> = {};
      const matterTypeCountsLastYear: Record<string, number> = {};

      (currentYearAppts || []).forEach((apt: any) => {
        const rawProvince = apt.referring_attorneys?.province;
        const province = normalizeProvince(rawProvince);
        provinceCounts[province] = (provinceCounts[province] || 0) + 1;

        const matterType = normalizeMatterType(apt.matter_type);
        matterTypeCounts[matterType] = (matterTypeCounts[matterType] || 0) + 1;
      });

      (lastYearAppts || []).forEach((apt: any) => {
        const rawProvince = apt.referring_attorneys?.province;
        const province = normalizeProvince(rawProvince);
        provinceCountsLastYear[province] = (provinceCountsLastYear[province] || 0) + 1;

        const matterType = normalizeMatterType(apt.matter_type);
        matterTypeCountsLastYear[matterType] = (matterTypeCountsLastYear[matterType] || 0) + 1;
      });

      // Merge all province names from both years
      const allProvinces = new Set([...Object.keys(provinceCounts), ...Object.keys(provinceCountsLastYear)]);
      const totalCases = Object.values(provinceCounts).reduce((s, c) => s + c, 0) || 1;
      const totalCasesLastYear = Object.values(provinceCountsLastYear).reduce((s, c) => s + c, 0) || 1;

      const provincialData: ProvincialData[] = Array.from(allProvinces)
        .filter((name) => name !== 'Unknown')
        .map((name) => ({
          name,
          cases: provinceCounts[name] || 0,
          pct: Math.round(((provinceCounts[name] || 0) / totalCases) * 100),
          casesLastYear: provinceCountsLastYear[name] || 0,
          pctLastYear: Math.round(((provinceCountsLastYear[name] || 0) / totalCasesLastYear) * 100),
        }))
        .sort((a, b) => b.cases - a.cases);

      const totalMatterCases = Object.values(matterTypeCounts).reduce((s, c) => s + c, 0) || 1;
      const totalMatterCasesLastYear = Object.values(matterTypeCountsLastYear).reduce((s, c) => s + c, 0) || 1;
      const allMatterTypes = new Set([...Object.keys(matterTypeCounts), ...Object.keys(matterTypeCountsLastYear)]);
      const caseTypeData: CaseTypeData[] = Array.from(allMatterTypes)
        .map((type) => ({
          type,
          count: matterTypeCounts[type] || 0,
          pct: Math.round(((matterTypeCounts[type] || 0) / totalMatterCases) * 100),
          countLastYear: matterTypeCountsLastYear[type] || 0,
          pctLastYear: Math.round(((matterTypeCountsLastYear[type] || 0) / totalMatterCasesLastYear) * 100),
        }))
        .sort((a, b) => b.count - a.count);

      // Fetch every report's status alongside the province of the referring
      // attorney on its linked appointment, so the operations map can show
      // resolved / in-progress / pending pins per province.
      const { data: reportsWithProvince } = await supabase
        .from('expert_reports')
        .select('report_status, appointments!expert_reports_appointment_id_fkey(referring_attorneys!appointments_referring_attorney_id_fkey(province))');

      const provinceStatusCounts: Record<string, { resolved: number; inProgress: number; pending: number }> = {};
      (reportsWithProvince || []).forEach((report: any) => {
        const rawProvince = report.appointments?.referring_attorneys?.province;
        const province = normalizeProvince(rawProvince);
        if (province === 'Unknown') return;

        const bucket = statusBucket(report.report_status);
        if (!bucket) return;

        if (!provinceStatusCounts[province]) {
          provinceStatusCounts[province] = { resolved: 0, inProgress: 0, pending: 0 };
        }
        provinceStatusCounts[province][bucket] += 1;
      });

      const provinceStatusData: ProvinceStatusData[] = Object.entries(provinceStatusCounts)
        .map(([name, counts]) => ({
          name,
          ...counts,
          total: counts.resolved + counts.inProgress + counts.pending,
        }))
        .sort((a, b) => b.total - a.total);

      // Count overdue reports (pending/in_progress older than 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { count: overdueCount } = await supabase
        .from('expert_reports')
        .select('*', { count: 'exact', head: true })
        .in('report_status', ['pending', 'not_received', 'in_progress', 'initial_stage', 'Pending', 'Not Received', 'Initial Stage'])
        .lt('created_at', thirtyDaysAgo.toISOString());

      // Fetch prior year report counts
      const { count: pendingCountLastYear } = await supabase
        .from('expert_reports')
        .select('*', { count: 'exact', head: true })
        .in('report_status', ['pending', 'not_received', 'under_review', 'Pending', 'Not Received'])
        .gte('created_at', lastYearStart)
        .lte('created_at', lastYearEnd);

      const { count: inProgressCountLastYear } = await supabase
        .from('expert_reports')
        .select('*', { count: 'exact', head: true })
        .in('report_status', ['in_progress', 'initial_stage', 'Initial Stage', 'Preparing Report', 'preparing_report', 'Report On Final Stage', 'report_on_final_stage'])
        .gte('created_at', lastYearStart)
        .lte('created_at', lastYearEnd);

      const { count: takenOutCountLastYear } = await supabase
        .from('expert_reports')
        .select('*', { count: 'exact', head: true })
        .in('report_status', ['taken_out', 'Taken Out', 'Report Submitted On AOD', 'report_submitted_on_aod', 'Report Submitted Without Full Payment', 'report_submitted_without_full_payment'])
        .gte('created_at', lastYearStart)
        .lte('created_at', lastYearEnd);

      const { count: completedCountLastYear } = await supabase
        .from('expert_reports')
        .select('*', { count: 'exact', head: true })
        .in('report_status', ['completed', 'Report fully paid & submitted', 'Report Fully Paid & Submitted', 'report_fully_paid_submitted', 'Report Submitted', 'report_submitted'])
        .gte('created_at', lastYearStart)
        .lte('created_at', lastYearEnd);

      setStats({
        totalClaimants: claimantsCount || 0,
        totalAppointments: appointmentsCount || 0,
        pendingReports: pendingCount || 0,
        reportsInProgress: inProgressCount || 0,
        reportsTakenOut: takenOutCount || 0,
        completedAssessments: completedCount || 0,
        provincialData,
        caseTypeData,
        provinceStatusData,
        overdueReports: overdueCount || 0,
        totalAppointmentsLastYear: (lastYearAppts || []).length,
        pendingReportsLastYear: pendingCountLastYear || 0,
        reportsInProgressLastYear: inProgressCountLastYear || 0,
        reportsTakenOutLastYear: takenOutCountLastYear || 0,
        completedAssessmentsLastYear: completedCountLastYear || 0,
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
