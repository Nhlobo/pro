import React, { useState, useEffect, useCallback } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  PortalPage,
  PortalHeader,
  SyncStatus,
  PortalStatStrip,
  PortalCard,
  PortalCardBody,
  PortalPill,
  type PortalStatTile,
  type PortalPillTone,
} from '@/components/attorney-portal/ui/PortalPrimitives';
import { format, parseISO, differenceInDays } from 'date-fns';

/**
 * Expert Portal — Report Tracking.
 *
 * Status previously mixed several ad-hoc badge colors (bg-primary/20
 * text-primary for "Taken Out"/"Under Review", bg-warning/20 etc) that
 * don't belong to this system's palette. Every status now maps to one
 * of the same four semantic pill tones (neutral/teal/success/warning/
 * destructive) the rest of the platform uses, each paired with the
 * matching system icon (Clock, CheckCircle2, AlertTriangle) instead of
 * relying on color alone. The four summary numbers are one bordered
 * PortalStatStrip panel, same as every other portal page, instead of
 * four separate floating cards.
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
  const [reports, setReports] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: profile } = await supabase.from('profiles').select('expert_id').eq('id', user.id).single();
    if (!profile?.expert_id) { setLoading(false); return; }

    const [reportsRes, apptsRes] = await Promise.all([
      supabase.from('expert_reports').select('*').eq('expert_id', profile.expert_id).order('created_at', { ascending: false }),
      supabase.from('appointments')
        .select(`id, appointment_date, matter_type, claimants(first_name, last_name, auto_id), referring_attorneys:referring_attorney_id(name)`)
        .eq('expert_id', profile.expert_id)
        .is('deleted_at', null),
    ]);
    setReports(reportsRes.data || []);
    setAppointments(apptsRes.data || []);
    setLoading(false);
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
        <PortalCardBody className="p-0">
          <ScrollArea className="max-h-[500px]">
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
                  {loading ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-slate-500 py-8">Loading reports…</TableCell></TableRow>
                  ) : reports.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-slate-500 py-8">No reports found</TableCell></TableRow>
                  ) : (
                    reports.map(r => {
                      const appt = appointments.find(a => a.id === r.appointment_id);
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium text-black">{appt?.claimants?.first_name} {appt?.claimants?.last_name}</TableCell>
                          <TableCell>{(appt as any)?.referring_attorneys?.name || 'N/A'}</TableCell>
                          <TableCell>{appt ? format(parseISO(appt.appointment_date), 'dd MMM yyyy') : '—'}</TableCell>
                          <TableCell>{r.report_due_date ? format(parseISO(r.report_due_date), 'dd MMM yyyy') : '—'}</TableCell>
                          <TableCell>{r.report_submitted_date ? format(parseISO(r.report_submitted_date), 'dd MMM yyyy') : '—'}</TableCell>
                          <TableCell>{r.days_to_complete ? <PortalPill tone="neutral">{r.days_to_complete}d</PortalPill> : '—'}</TableCell>
                          <TableCell><StatusPill status={r.report_status} /></TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
        </PortalCardBody>
      </PortalCard>
    </PortalPage>
  );
};

export default ExpertReportTracking;
