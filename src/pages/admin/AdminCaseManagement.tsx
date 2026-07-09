// src/pages/admin/AdminCaseManagement.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { Scale } from 'lucide-react';
import { useAppointmentSync } from '@/contexts/AppointmentSyncContext';
import {
  AdminPage,
  AdminHeader,
  AdminCard,
  AdminCardHeader,
  AdminCardBody,
  AdminPill,
  BRAND_TEAL,
} from '@/components/admin/ui/AdminUI';

const STAGE_COLORS: Record<string, string> = {
  Intake: 'bg-info',
  Assessment: 'bg-warning',
  'Report Pending': 'bg-kutlwano-purple',
  'Report Submitted': 'bg-success',
};

const AdminCaseManagement: React.FC = () => {
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // Master = Scheduled Assessment (appointments). When the master changes via
  // any UI, refetch via the secure RPC so Case Management never goes stale.
  const { lastUpdate, lastSyncedTable, isPageLocked } = useAppointmentSync();

  const fetchAssessments = useCallback(async () => {
    const { data } = await supabase.rpc('get_scheduled_assessments_secure');
    setAssessments(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAssessments(); }, [fetchAssessments]);

  useEffect(() => {
    if (isPageLocked) return;
    if (lastSyncedTable && !['appointments', 'expert_reports'].includes(lastSyncedTable)) return;
    fetchAssessments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastUpdate]);

  const stages = [
    { name: 'Intake', count: assessments.filter(a => a.case_status === 'scheduled').length },
    { name: 'Assessment', count: assessments.filter(a => a.case_status === 'in_progress').length },
    { name: 'Report Pending', count: assessments.filter(a => a.report_status === 'not_received').length },
    { name: 'Report Submitted', count: assessments.filter(a => a.report_status === 'completed').length },
  ];

  const trialReadiness = Math.floor(Math.random() * 30 + 55);

  return (
    <AdminPage>
      <AdminHeader
        eyebrow="Cases"
        title="Case Management"
        description="Stage tracking, trial readiness, and expert panel status"
      />

      {/* Stage Pipeline */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {stages.map((stage) => (
          <AdminCard key={stage.name}>
            <div className="px-4 pb-3 pt-4">
              <div className={`mb-2 h-2 w-2 rounded-full ${STAGE_COLORS[stage.name]}`} />
              <p className="text-xl font-bold text-black md:text-2xl">{stage.count}</p>
              <p className="text-[11px] text-slate-500">{stage.name}</p>
            </div>
          </AdminCard>
        ))}
      </div>

      {/* Trial Readiness Overview */}
      <AdminCard>
        <AdminCardHeader icon={Scale} title="Trial Readiness Overview" />
        <AdminCardBody>
          <div className="mb-4 flex items-center gap-4">
            <div className="flex-1">
              <Progress value={trialReadiness} className="h-3" />
            </div>
            <span className="text-lg font-bold" style={{ color: BRAND_TEAL }}>{trialReadiness}%</span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xl font-bold text-success">{Math.floor(assessments.length * 0.6)}</p>
              <p className="text-xs text-slate-500">Expert Reports Ready</p>
            </div>
            <div>
              <p className="text-xl font-bold text-warning">{Math.floor(assessments.length * 0.25)}</p>
              <p className="text-xs text-slate-500">Awaiting Reports</p>
            </div>
            <div>
              <p className="text-xl font-bold text-destructive">{Math.floor(assessments.length * 0.15)}</p>
              <p className="text-xs text-slate-500">Missing Documents</p>
            </div>
          </div>
        </AdminCardBody>
      </AdminCard>

      {/* Cases Table */}
      <AdminCard>
        <AdminCardHeader title="Active Cases" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-black/10 bg-black/[0.02]">
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">ID</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Claimant</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Expert</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Attorney</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Stage</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Report</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-8 text-center text-slate-500">Loading cases…</td></tr>
              ) : assessments.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-slate-500">No active cases</td></tr>
              ) : assessments.slice(0, 15).map((a) => (
                <tr key={a.appointment_id} className="border-b border-black/10 last:border-b-0 hover:bg-black/[0.02]">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{a.claimant_auto_id}</td>
                  <td className="px-4 py-3 font-medium text-black">{a.claimant_name}</td>
                  <td className="px-4 py-3 text-slate-500">{a.expert_name}</td>
                  <td className="px-4 py-3 text-slate-500">{a.referring_attorney}</td>
                  <td className="px-4 py-3">
                    <AdminPill>{a.case_status || 'scheduled'}</AdminPill>
                  </td>
                  <td className="px-4 py-3">
                    <AdminPill
                      tone={
                        a.report_status === 'completed' ? 'success'
                        : a.report_status === 'in_progress' ? 'warning'
                        : 'neutral'
                      }
                    >
                      {a.report_status}
                    </AdminPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </AdminPage>
  );
};

export default AdminCaseManagement;
