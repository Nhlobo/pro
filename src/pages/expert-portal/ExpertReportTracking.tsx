import React, { useState, useEffect, useCallback } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Clock, CheckCircle2, AlertTriangle, User, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import {
  PortalPage,
  PortalHeader,
  SyncStatus,
  PortalStatStrip,
  PortalCard,
  PortalCardHeader,
  PortalCardBody,
  PortalEmptyState,
  PortalLoadingState,
  PortalPill,
  type PortalStatTile,
  type PortalPillTone,
} from '@/components/attorney-portal/ui/PortalPrimitives';
import { ExpertNotLinkedState } from '@/components/portal/ExpertNotLinkedState';
import { useExpertLinkStatus } from '@/hooks/useExpertLinkStatus';
import { format, parseISO, differenceInDays } from 'date-fns';

/**
 * Expert Portal — Report Tracking.
 *
 * Status previously mixed several ad-hoc badge colors that don't
 * belong to this system's palette; every status now maps to one of
 * the same semantic pill tones the rest of the platform uses, each
 * paired with a system icon. The table itself now follows the same
 * "flexible table" pattern as AttorneyMyCases.tsx: a real `<Table>`
 * on desktop (md+) and a tap-friendly stacked card list on mobile,
 * instead of one table forced to scroll sideways on a phone.
 */

const STATUS_TONE: Record<string, PortalPillTone> = {
  completed: 'success',
  taken_out: 'teal',
  in_progress: 'warning',
  under_review: 'teal',
};

const STATUS_ICON: Record<string, typeof Clock> = {
  completed: CheckCircle2,
  taken_out: CheckCircle2,
  in_progress: Clock,
  under_review: Clock,
};

const STATUS_LABEL: Record<string, string> = {
  completed: 'Completed',
  taken_out: 'Taken Out',
  in_progress: 'In Progress',
  under_review: 'Under Review',
};

function StatusPill({ status }: { status: string | null }) {
  const key = status || '';
  const tone = STATUS_TONE[key] || 'neutral';
  const Icon = STATUS_ICON[key] || AlertTriangle;
  const label = STATUS_LABEL[key] || 'Not Received';
  return (
    <PortalPill tone={tone}>
      <Icon className="h-3 w-3" />
      {label}
    </PortalPill>
  );
}

const ExpertReportTracking: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const linkStatus = useExpertLinkStatus();
  const [reports, setReports] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notLinked, setNotLinked] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: profile } = await supabase.from('profiles').select('expert_id').eq('id', user.id).single();
      if (!profile?.expert_id) { setNotLinked(true); setLoading(false); return; }

      const [reportsRes, apptsRes] = await Promise.all([
        supabase.from('expert_reports').select('*').eq('expert_id', profile.expert_id).order('created_at', { ascending: false }),
        supabase.from('appointments')
          .select(`id, appointment_date, matter_type, claimants(first_name, last_name, auto_id), referring_attorneys:referring_attorney_id(name)`)
          .eq('expert_id', profile.expert_id)
          .is('deleted_at', null),
      ]);
      setReports(reportsRes.data || []);
      setAppointments(apptsRes.data || []);
    } catch (error) {
      console.error('[ExpertReportTracking] load failed', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const stats = {
    total: reports.length,
    pending: reports.filter(r => !['completed', 'taken_out'].includes(r.report_status || '')).length,
    completed: reports.filter(r => r.report_status === 'completed').length,
    overdue: reports.filter(r => {
      if (!r.report_due_date || r.report_status === 'completed') return false;
      return differenceInDays(parseISO(r.report_due_date), new Date()) < 0;
    }).length,
  };

  const statTiles: PortalStatTile[] = [
    { label: 'Total Reports', value: stats.total, icon: FileText },
    { label: 'Pending', value: stats.pending, icon: Clock },
    { label: 'Completed', value: stats.completed, icon: CheckCircle2 },
    { label: 'Overdue', value: stats.overdue, icon: AlertTriangle, urgent: stats.overdue > 0 },
  ];

  if (linkStatus === 'checking') {
    return (
      <PortalPage>
        <PortalHeader eyebrow="Expert Portal" title="Report Tracking" icon={FileText} />
        <PortalLoadingState label="Checking your account…" />
      </PortalPage>
    );
  }

  if (linkStatus === 'not_linked' || notLinked) {
    return (
      <PortalPage>
        <PortalHeader eyebrow="Expert Portal" title="Report Tracking" icon={FileText} />
        <ExpertNotLinkedState description="Your account is not linked to a medical expert profile, so there are no reports to show yet. Contact an administrator or get help below." />
      </PortalPage>
    );
  }

  return (
    <PortalPage>
      <PortalHeader
        eyebrow="Expert Portal"
        title="Report Tracking"
        description="Track all report submissions and deadlines."
        icon={FileText}
        actions={<SyncStatus loading={loading} onRefresh={load} label="Live data" />}
      />

      <PortalStatStrip tiles={statTiles} loading={loading} className="sm:grid-cols-4" />

      <PortalCard>
        <PortalCardHeader icon={FileText} title={`Reports (${reports.length})`} />
        {loading ? (
          <PortalLoadingState label="Loading reports…" />
        ) : reports.length === 0 ? (
          <PortalEmptyState icon={FileText} title="No reports found" />
        ) : (
          <>
            {/* Desktop table */}
            <ScrollArea className="hidden max-h-[500px] md:block">
              <div className="overflow-x-auto">
                <Table className="text-xs [&_td]:px-3 [&_td]:py-2.5 [&_th]:h-9 [&_th]:px-3 [&_th]:text-[11px]">
                  <TableHeader className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_theme(colors.black/10%)]">
                    <TableRow>
                      <TableHead>Claimant</TableHead>
                      <TableHead>Attorney</TableHead>
                      <TableHead>Assessment Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map(r => {
                      const appt = appointments.find(a => a.id === r.appointment_id);
                      return (
                        <TableRow
                          key={r.id}
                          className={appt ? 'cursor-pointer hover:bg-black/[0.02]' : undefined}
                          onClick={() => appt && navigate(`/expert-portal/case/${appt.id}`)}
                        >
                          <TableCell className="font-medium text-black">{appt?.claimants?.first_name} {appt?.claimants?.last_name}</TableCell>
                          <TableCell className="text-slate-500">{(appt as any)?.referring_attorneys?.name || 'N/A'}</TableCell>
                          <TableCell className="text-slate-500">{appt ? format(parseISO(appt.appointment_date), 'dd MMM yyyy') : '—'}</TableCell>
                          <TableCell className="text-slate-500">{r.report_due_date ? format(parseISO(r.report_due_date), 'dd MMM yyyy') : '—'}</TableCell>
                          <TableCell className="text-slate-500">{r.report_submitted_date ? format(parseISO(r.report_submitted_date), 'dd MMM yyyy') : '—'}</TableCell>
                          <TableCell>{r.days_to_complete ? <PortalPill tone="neutral">{r.days_to_complete}d</PortalPill> : <span className="text-slate-400">—</span>}</TableCell>
                          <TableCell><StatusPill status={r.report_status} /></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>

            {/* Mobile cards — same rows, no sideways scroll */}
            <ScrollArea className="h-[560px] md:hidden">
              <div className="divide-y divide-black/10">
                {reports.map(r => {
                  const appt = appointments.find(a => a.id === r.appointment_id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      disabled={!appt}
                      onClick={() => appt && navigate(`/expert-portal/case/${appt.id}`)}
                      className="flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors hover:bg-black/[0.02] disabled:cursor-default"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 truncate text-sm font-medium text-black">
                          {appt?.claimants?.first_name} {appt?.claimants?.last_name}
                        </p>
                        <StatusPill status={r.report_status} />
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1"><User className="h-3 w-3" />{(appt as any)?.referring_attorneys?.name || 'N/A'}</span>
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{appt ? format(parseISO(appt.appointment_date), 'dd MMM yyyy') : '—'}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                        {r.report_due_date && <span>Due {format(parseISO(r.report_due_date), 'dd MMM yyyy')}</span>}
                        {r.report_submitted_date && <span>Submitted {format(parseISO(r.report_submitted_date), 'dd MMM yyyy')}</span>}
                        {r.days_to_complete ? <PortalPill tone="neutral">{r.days_to_complete}d</PortalPill> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </>
        )}
      </PortalCard>
    </PortalPage>
  );
};

export default ExpertReportTracking;
