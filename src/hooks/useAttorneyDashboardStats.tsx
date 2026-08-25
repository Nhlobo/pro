import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAppointmentSync } from '@/contexts/AppointmentSyncContext';

// Hook to provide attorney dashboard stats with page lock awareness

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
  /** Same value as `id` — appointments.id. Added so consumers reading
   * `appointmentId` (AttorneyReports.tsx) get a real value instead of
   * an always-undefined property access. */
  appointmentId: string;
  caseStatus: string | null;
  reportVersions: {
    id: string;
    file_name: string;
    file_path: string;
    version_number: number;
    created_at: string;
  }[];
}

export const useAttorneyDashboardStats = () => {
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
      // Six independent queries — none depends on another's result — so
      // they run in parallel instead of the sequential waterfall this
      // used to be. Same data, same RLS scoping (attorneys only ever
      // see their own referring_attorney_id's appointments, enforced by
      // the "Users can view appointments from their referring attorney"
      // policy — see get_current_user_referring_attorney()), just not
      // blocking each other for no reason.
      const [
        { count: mattersCount },
        { count: inProgressCount },
        { count: readyCount },
        { count: pendingConfirmations },
        { data: appointmentsData },
        { data: documentsData },
      ] = await Promise.all([
        supabase
          .from('appointments')
          .select('*', { count: 'exact', head: true })
          .is('deleted_at', null),
        supabase
          .from('expert_reports')
          .select('*', { count: 'exact', head: true })
          .in('report_status', [
            'in_progress', 'initial_stage', 'Initial Stage',
            'Preparing Report', 'preparing_report',
            'Report On Final Stage', 'report_on_final_stage',
            'under_review', 'pending', 'not_received', 'Pending', 'Not Received'
          ]),
        supabase
          .from('expert_reports')
          .select('*', { count: 'exact', head: true })
          .in('report_status', [
            'completed', 'Report fully paid & submitted', 'Report Fully Paid & Submitted',
            'report_fully_paid_submitted', 'Report Submitted', 'report_submitted',
            'taken_out', 'Taken Out', 'Report Submitted On AOD', 'report_submitted_on_aod',
            'Report Submitted Without Full Payment', 'report_submitted_without_full_payment'
          ]),
        supabase
          .from('appointment_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending'),
        supabase
          .from('appointments')
          .select('id')
          .is('deleted_at', null),
        supabase
          .from('documents')
          .select('appointment_id')
          .not('appointment_id', 'is', null),
      ]);

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

      // Fetch live case data for the case list. No .limit() here — this
      // is the same array AttorneyMyCases.tsx and AttorneyReports.tsx
      // use as their PRIMARY, COMPLETE case list (not a preview), so
      // capping it here silently truncated "My Cases" to 20 entries
      // and undercounted the Dashboard's own "Total Active Cases" tile
      // and "View All N Cases" link (both read liveCases.length).
      // AttorneyPortalDashboard.tsx already does its own
      // liveCases.slice(0, 5) for its small preview widget — that's
      // the right place for a preview cap, not here, where every
      // other consumer needs the true, complete list.
      //
      // The report file itself comes from `documents` (document_type =
      // 'Expert Report'), NOT `report_versions` — report_versions has a
      // schema but is never written to by any code path in this app;
      // the real file an expert submits (ExpertCaseDetail.tsx) is
      // inserted straight into `documents`. RLS (Phase 27) already
      // filters this embed down to only reports that are both
      // is_visible_to_attorney and past staff review, so an empty
      // result here correctly means "not available to you yet",
      // not "query is broken".
      const { data: casesData } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          case_status,
          claimants(first_name, last_name, auto_id),
          medical_experts(expert_type),
          expert_reports(report_status, report_submitted_date, created_at),
          documents(id, file_name, file_path, document_type, approval_status, created_at)
        `)
        .is('deleted_at', null)
        .order('appointment_date', { ascending: false });

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

        // The actual report file lives in `documents` (document_type =
        // 'Expert Report'), not the orphaned report_versions table —
        // nothing in this codebase ever writes a report_versions row.
        // RLS (Phase 27) already excludes documents still pending staff
        // approval or explicitly hidden from the attorney, so whatever
        // comes back here is genuinely available to download. Mapped
        // into the same {file_name, file_path, version_number,
        // created_at} shape AttorneyReports.tsx already expects —
        // version_number is synthesized from upload order since these
        // rows were never actually versioned.
        const reportDocs = (Array.isArray(appointment.documents) ? appointment.documents : [])
          .filter((d: any) => d.document_type === 'Expert Report')
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const reportVersions = reportDocs.map((d: any, idx: number) => ({
          id: d.id,
          file_name: d.file_name,
          file_path: d.file_path,
          version_number: reportDocs.length - idx,
          created_at: d.created_at,
        }));

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
          phases,
          // appointmentId duplicates `id` under the name AttorneyReports.tsx
          // was actually reading — it previously read (c as any).appointmentId,
          // a field that never existed on this object, so it was always
          // null there regardless of the real appointment id.
          appointmentId: appointment.id,
          caseStatus: appointment.case_status,
          reportVersions,
        };
      });

      setLiveCases(processedCases);
    } catch (error) {
      console.error('Error fetching attorney dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Always fetch on initial mount, then respect sync conditions for updates
  const initialFetchDone = useRef(false);
  useEffect(() => {
    if (!initialFetchDone.current) {
      fetchStats();
      initialFetchDone.current = true;
    } else if (isActiveTab && !isPageLocked) {
      fetchStats();
    }
  }, [lastUpdate, fetchStats, isActiveTab, isPageLocked]);

  return { stats, liveCases, loading, refetchStats: fetchStats };
};
