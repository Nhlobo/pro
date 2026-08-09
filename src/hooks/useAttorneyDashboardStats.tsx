import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAppointmentSync } from '@/contexts/AppointmentSyncContext';

// Hook to provide attorney dashboard stats with page lock awareness
//
// This hook has two data sources depending on how the caller is signed in
// Legacy external portal session handling previously supported:
//   1. Supabase-auth session (unchanged, original behaviour below) — RLS
//      scopes every query to the signed-in attorney automatically.
//   2. External Portal Module OTP/access-link session — has no
//      auth.users row, so the direct supabase.from() queries below would
//      be blocked by RLS. For this case we instead derive the exact same
//      `stats` / `liveCases` shape from the session-scoped
//      external-portal-attorney-data edge function via useAttorneyCases().
// No database or edge-function change was needed for this — it reuses
// data that function already returns.

const REPORT_IN_PROGRESS_STATUSES = [
  'in_progress', 'initial_stage', 'preparing_report', 'report_on_final_stage', 'under_review', 'pending', 'not_received',
];
const REPORT_READY_STATUSES = [
  'completed', 'report_fully_paid_submitted', 'report_submitted', 'taken_out', 'report_submitted_on_aod', 'report_submitted_without_full_payment',
];

function phasesFromSummary(c: AttorneyCaseSummary) {
  const reportStatus = (c.report?.report_status || '').toLowerCase();
  const caseStatus = c.case_status || '';
  const phases = [
    { name: 'Referral Received', status: 'completed' as const, completedAt: c.appointment_date },
    { name: 'Documents Verified', status: (caseStatus === 'scheduled' || reportStatus) ? 'completed' as const : 'pending' as const },
    { name: 'Appointment Scheduled', status: c.appointment_date ? 'completed' as const : 'pending' as const, completedAt: c.appointment_date },
    {
      name: 'Claimant Assessed',
      status: ['completed', 'in_progress', 'assessed'].includes(caseStatus) || reportStatus
        ? 'completed' as const
        : caseStatus === 'scheduled' ? 'in_progress' as const : 'pending' as const,
    },
    {
      name: 'Report Drafting',
      status: ['in_progress', 'initial_stage', 'preparing_report', 'report_on_final_stage'].some(s => reportStatus.includes(s))
        ? 'in_progress' as const
        : ['completed', 'taken_out', 'under_review', 'report_submitted'].some(s => reportStatus.includes(s))
          ? 'completed' as const : 'pending' as const,
    },
    {
      name: 'Quality Review',
      status: reportStatus.includes('under_review') || reportStatus.includes('final_stage')
        ? 'in_progress' as const
        : ['completed', 'taken_out', 'report_submitted'].some(s => reportStatus.includes(s))
          ? 'completed' as const : 'pending' as const,
    },
    {
      name: 'Report Ready',
      status: ['completed', 'taken_out', 'report_submitted', 'report fully paid'].some(s => reportStatus.includes(s))
        ? 'completed' as const : 'pending' as const,
      completedAt: c.report?.report_submitted_date || undefined,
    },
  ];
  const currentPhaseIndex = phases.findIndex(p => p.status === 'in_progress');
  const lastCompletedIndex = phases.map((p, i) => p.status === 'completed' ? i : -1).filter(i => i >= 0).pop() ?? -1;
  const phaseOrder = currentPhaseIndex >= 0 ? currentPhaseIndex : lastCompletedIndex + 1;
  return { phases, phaseOrder, currentPhase: phases[phaseOrder]?.name || phases[0].name };
}

export interface AttorneyDashboardStats {
  mattersSubmitted: number;
  reportsInProgress: number;
  reportsReadyToDownload: number;
  actionsNeeded: number;
  missingDocuments: number;
  pendingConfirmations: number;
}

export interface LiveCaseStatus {
  id: string;
  claimantName: string;
  claimantAutoId: string;
  expertType: string;
  appointmentDate: string;
  currentPhase: string;
  phaseOrder: number;
  phases: {
    name: string;
    status: 'completed' | 'in_progress' | 'pending';
    completedAt?: string;
  }[];
}

export const useAttorneyDashboardStats = () => {
  const isExternalSession = false;

  // External Portal Module (OTP/access-link) session: always call this
  // hook (react-query no-ops it via `enabled` when there's no session),
  // never conditionally, so Rules of Hooks stay intact either way.
  const externalCasesQuery = useAttorneyCases();

  const [stats, setStats] = useState<AttorneyDashboardStats>({
    mattersSubmitted: 0,
    reportsInProgress: 0,
    reportsReadyToDownload: 0,
    actionsNeeded: 0,
    missingDocuments: 0,
    pendingConfirmations: 0,
  });
  const [liveCases, setLiveCases] = useState<LiveCaseStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const { lastUpdate, isActiveTab, isPageLocked } = useAppointmentSync();

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch matters submitted (total appointments/referrals)
      const { count: mattersCount } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null);

      // Fetch reports in progress
      const { count: inProgressCount } = await supabase
        .from('expert_reports')
        .select('*', { count: 'exact', head: true })
        .in('report_status', [
          'in_progress', 'initial_stage', 'Initial Stage', 
          'Preparing Report', 'preparing_report', 
          'Report On Final Stage', 'report_on_final_stage',
          'under_review', 'pending', 'not_received', 'Pending', 'Not Received'
        ]);

      // Fetch reports ready to download (completed/taken out)
      const { count: readyCount } = await supabase
        .from('expert_reports')
        .select('*', { count: 'exact', head: true })
        .in('report_status', [
          'completed', 'Report fully paid & submitted', 'Report Fully Paid & Submitted',
          'report_fully_paid_submitted', 'Report Submitted', 'report_submitted',
          'taken_out', 'Taken Out', 'Report Submitted On AOD', 'report_submitted_on_aod',
          'Report Submitted Without Full Payment', 'report_submitted_without_full_payment'
        ]);

      // Fetch pending confirmations (appointment requests not yet approved)
      const { count: pendingConfirmations } = await supabase
        .from('appointment_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // Fetch appointments missing documents (appointments without associated documents)
      const { data: appointmentsData } = await supabase
        .from('appointments')
        .select('id')
        .is('deleted_at', null);

      const { data: documentsData } = await supabase
        .from('documents')
        .select('appointment_id')
        .not('appointment_id', 'is', null);

      const appointmentIdsWithDocs = new Set(documentsData?.map(d => d.appointment_id) || []);
      const missingDocsCount = appointmentsData?.filter(a => !appointmentIdsWithDocs.has(a.id)).length || 0;

      const actionsNeeded = (pendingConfirmations || 0) + missingDocsCount;

      setStats({
        mattersSubmitted: mattersCount || 0,
        reportsInProgress: inProgressCount || 0,
        reportsReadyToDownload: readyCount || 0,
        actionsNeeded,
        missingDocuments: missingDocsCount,
        pendingConfirmations: pendingConfirmations || 0,
      });

      // Fetch live case data for timeline
      const { data: casesData } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          case_status,
          claimants(first_name, last_name, auto_id),
          medical_experts(expert_type),
          expert_reports(report_status, report_submitted_date, created_at)
        `)
        .is('deleted_at', null)
        .order('appointment_date', { ascending: false })
        .limit(20);

      const processedCases: LiveCaseStatus[] = (casesData || []).map(appointment => {
        const claimant = Array.isArray(appointment.claimants) 
          ? appointment.claimants[0] 
          : appointment.claimants;
        const expert = Array.isArray(appointment.medical_experts) 
          ? appointment.medical_experts[0] 
          : appointment.medical_experts;
        const report = Array.isArray(appointment.expert_reports) 
          ? appointment.expert_reports[0] 
          : appointment.expert_reports;

        const reportStatus = report?.report_status?.toLowerCase() || '';

        // Define phases with their status
        const phases = [
          {
            name: 'Referral Received',
            status: 'completed' as const,
            completedAt: appointment.appointment_date
          },
          {
            name: 'Documents Verified',
            status: appointment.case_status === 'scheduled' || reportStatus ? 'completed' as const : 'pending' as const,
          },
          {
            name: 'Appointment Scheduled',
            status: appointment.appointment_date ? 'completed' as const : 'pending' as const,
            completedAt: appointment.appointment_date
          },
          {
            name: 'Claimant Assessed',
            status: ['completed', 'in_progress', 'assessed'].includes(appointment.case_status || '') || reportStatus 
              ? 'completed' as const 
              : appointment.case_status === 'scheduled' 
                ? 'in_progress' as const 
                : 'pending' as const,
          },
          {
            name: 'Report Drafting',
            status: ['in_progress', 'initial_stage', 'preparing_report', 'report_on_final_stage'].some(s => reportStatus.includes(s))
              ? 'in_progress' as const
              : ['completed', 'taken_out', 'under_review', 'report_submitted'].some(s => reportStatus.includes(s))
                ? 'completed' as const
                : 'pending' as const,
          },
          {
            name: 'Quality Review',
            status: reportStatus.includes('under_review') || reportStatus.includes('final_stage')
              ? 'in_progress' as const
              : ['completed', 'taken_out', 'report_submitted'].some(s => reportStatus.includes(s))
                ? 'completed' as const
                : 'pending' as const,
          },
          {
            name: 'Report Ready',
            status: ['completed', 'taken_out', 'report_submitted', 'report fully paid'].some(s => reportStatus.includes(s))
              ? 'completed' as const
              : 'pending' as const,
            completedAt: report?.report_submitted_date
          }
        ];

        // Find current phase
        const currentPhaseIndex = phases.findIndex(p => p.status === 'in_progress');
        const lastCompletedIndex = phases.map((p, i) => p.status === 'completed' ? i : -1).filter(i => i >= 0).pop() ?? -1;
        const phaseOrder = currentPhaseIndex >= 0 ? currentPhaseIndex : lastCompletedIndex + 1;
        const currentPhase = phases[phaseOrder]?.name || phases[0].name;

        return {
          id: appointment.id,
          claimantName: claimant 
            ? `${claimant.first_name || ''} ${claimant.last_name || ''}`.trim() 
            : 'Unknown',
          claimantAutoId: claimant?.auto_id || '',
          expertType: expert?.expert_type || 'Unknown',
          appointmentDate: appointment.appointment_date,
          currentPhase,
          phaseOrder,
          phases
        };
      });

      setLiveCases(processedCases);
    } catch (error) {
      console.error('Error fetching attorney dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Always fetch on initial mount, then respect sync conditions for updates.
  // Skipped entirely for external sessions — those never had a Supabase
  // auth.uid(), so this query would just be blocked by RLS anyway; the
  // external-portal-attorney-data edge function (via useAttorneyCases,
  // below) is the live data source in that mode instead.
  const initialFetchDone = useRef(false);
  useEffect(() => {
    if (isExternalSession) return;
    if (!initialFetchDone.current) {
      fetchStats();
      initialFetchDone.current = true;
    } else if (isActiveTab && !isPageLocked) {
      fetchStats();
    }
  }, [lastUpdate, fetchStats, isActiveTab, isPageLocked, isExternalSession]);

  // Derive the same `stats` / `liveCases` shape from the external-portal
  // session's case list. Two fields (missingDocuments, pendingConfirmations)
  // aren't part of that projection — they default to 0 in this mode rather
  // than guessing, since building new aggregate-count endpoints for them
  // is out of scope here.
  const externalDerived = useMemo(() => {
    const cases = externalCasesQuery.data?.cases || [];
    const derivedLiveCases: LiveCaseStatus[] = cases.map((c) => {
      const { phases, phaseOrder, currentPhase } = phasesFromSummary(c);
      return {
        id: c.appointment_id,
        claimantName: c.claimant ? `${c.claimant.first_name || ''} ${c.claimant.last_name || ''}`.trim() : 'Unknown',
        claimantAutoId: c.claimant?.reference || '',
        expertType: c.expert?.expert_type || 'Unknown',
        appointmentDate: c.appointment_date,
        currentPhase,
        phaseOrder,
        phases,
      };
    });
    const reportsInProgress = cases.filter(c => REPORT_IN_PROGRESS_STATUSES.includes((c.report?.report_status || '').toLowerCase())).length;
    const reportsReadyToDownload = cases.filter(c => REPORT_READY_STATUSES.includes((c.report?.report_status || '').toLowerCase())).length;
    return {
      stats: {
        mattersSubmitted: cases.length,
        reportsInProgress,
        reportsReadyToDownload,
        actionsNeeded: 0,
        missingDocuments: 0,
        pendingConfirmations: 0,
      } as AttorneyDashboardStats,
      liveCases: derivedLiveCases,
    };
  }, [externalCasesQuery.data]);

  const refetchStats = useCallback(async () => {
    if (isExternalSession) {
      await externalCasesQuery.refetch();
      return;
    }
    await fetchStats();
  }, [isExternalSession, externalCasesQuery, fetchStats]);

  if (isExternalSession) {
    return {
      stats: externalDerived.stats,
      liveCases: externalDerived.liveCases,
      loading: externalCasesQuery.isLoading,
      refetchStats,
    };
  }

  return { stats, liveCases, loading, refetchStats };
};
