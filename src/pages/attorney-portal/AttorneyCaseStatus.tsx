import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { AttorneyPortalLayout } from '@/components/portal/AttorneyPortalLayout';
import { AttorneyNotLinkedState } from '@/components/portal/AttorneyNotLinkedState';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useAttorneyLinkStatus } from '@/hooks/useAttorneyLinkStatus';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  Users, CheckCircle2, Calendar, FileText, AlertTriangle,
  Search, Filter, ArrowLeft, User, Clock, Download, Bell,
  Activity, Stethoscope, Loader2, ChevronRight, FileCheck
} from 'lucide-react';
import { formatExpertType } from '@/utils/expertTypeMapping';
import { format, formatDistanceToNow, differenceInDays } from 'date-fns';
import { BRAND_TEAL } from '@/components/admin/ui/AdminUI';
import {
  PortalPage,
  PortalHeader,
  SyncStatus,
  PortalStatStrip,
  PortalCard,
  PortalCardHeader,
  PortalCardBody,
  PortalPill,
  PortalEmptyState,
  PortalLoadingState,
  type PortalPillTone,
} from '@/components/attorney-portal/ui/PortalPrimitives';

const FIELD_CLASS = 'rounded-none border-black/15 focus-visible:ring-[#00BAAD]/30';

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────
const REPORT_RECEIVED_STATUSES = [
  'completed', 'taken_out', 'taken out', 'report_submitted', 'report submitted',
  'report_fully_paid_submitted', 'report fully paid & submitted',
  'report_submitted_on_aod', 'report submitted on aod',
];

const isReportReceived = (status?: string | null) =>
  REPORT_RECEIVED_STATUSES.includes((status || '').toLowerCase());

const isReportOverdue = (dueDate?: string | null, status?: string | null) => {
  if (isReportReceived(status) || !dueDate) return false;
  return new Date(dueDate) < new Date();
};

// Normalize matter_type to one of the requested labels
const normalizeClaimType = (raw?: string | null): string => {
  if (!raw) return '—';
  const k = raw.toLowerCase().replace(/[_\s-]+/g, ' ').trim();
  if (k.includes('raf') || k.includes('mva') || k.includes('road accident')) return 'RAF';
  if (k.includes('negligence') || k.includes('medical neg')) return 'Medical Negligence';
  if (k.includes('personal injury') || k.includes('slip') || k.includes('fall') || k.includes('assault')) return 'Personal Injury';
  if (k.includes('merit')) return 'Merit Report';
  return raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

interface AssessmentRow {
  appointment_id: string;
  appointment_date: string;
  case_status: string | null;
  matter_type: string | null;
  expert_type: string;
  report_status: string | null;
  report_submitted_date: string | null;
  report_due_date: string | null;
  report_id?: string;
  report_file_path?: string | null;
}

type Stage = 'Referral' | 'Booking' | 'Assessment' | 'Reports' | 'Litigation' | 'Closed';

interface ClaimantCase {
  claimantId: string;
  claimantAutoId: string;
  claimantName: string;
  matterType: string | null;
  lastUpdated: string;
  assessments: AssessmentRow[];
  reportsRequired: number;
  reportsReceived: number;
  reportsOutstanding: number;
  stage: Stage;
  progressPct: number;
  hasOverdue: boolean;
}

const STAGES: Stage[] = ['Referral', 'Booking', 'Assessment', 'Reports', 'Litigation', 'Closed'];

const isCaseClosed = (c: ClaimantCase) =>
  c.assessments.length > 0 && c.assessments.every(a => isReportReceived(a.report_status));

const computeStage = (assessments: AssessmentRow[]): { stage: Stage; pct: number } => {
  if (assessments.length === 0) return { stage: 'Referral', pct: 10 };
  const allReportsReceived = assessments.every(a => isReportReceived(a.report_status));
  if (allReportsReceived) return { stage: 'Closed', pct: 100 };

  const anyAssessed = assessments.some(a =>
    ['assessed', 'completed', 'done', 'report_submitted'].includes((a.case_status || '').toLowerCase())
    || isReportReceived(a.report_status)
  );
  const anyScheduled = assessments.some(a =>
    ['scheduled', 'confirmed', 'in_progress'].includes((a.case_status || '').toLowerCase())
  );
  const anyReportInProgress = assessments.some(a => {
    const s = (a.report_status || '').toLowerCase();
    return s && !isReportReceived(s);
  });

  if (anyAssessed && anyReportInProgress) return { stage: 'Reports', pct: 70 };
  if (anyAssessed) return { stage: 'Reports', pct: 60 };
  if (anyScheduled) return { stage: 'Assessment', pct: 40 };
  return { stage: 'Booking', pct: 25 };
};

// ─────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────
const AttorneyCaseStatus: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [view, setView] = useState<'dashboard' | 'detail'>('dashboard');
  const [selectedClaimantId, setSelectedClaimantId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed' | 'reports_outstanding' | 'litigation_ready'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'most_outstanding'>('newest');
  const [activeQuickFilter, setActiveQuickFilter] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [claimants, setClaimants] = useState<ClaimantCase[]>([]);

  // Whether this account is linked to a firm's referrals at all
  // (profiles.referring_attorney_id). This is the SAME check every
  // other Attorney Portal page uses, and — unlike the old
  // `user_attorney_links` table this page used to query — it is
  // actually populated for bridged External Portal sessions (synced
  // by external-portal-auth on login), not just native firm-created
  // logins. `user_attorney_links` is a separate, admin-only,
  // multi-firm linking table (see EditProfileDialog) that a bridged
  // portal account never gets a row in, so gating on it made this
  // page show "not linked" for every real, active attorney account
  // that came in through the External Portal.
  const linkStatus = useAttorneyLinkStatus();

  // Load all attorney-scoped claimants + appointments + reports + report
  // docs. No client-side attorney/firm filter here — the Appointment
  // Engine (via `claimants`) is queried directly and RLS is what scopes
  // the result to this exact person: firm-wide for a native/old-portal
  // login, or narrowed to their own assigned_attorney_contact_id cases
  // for a bridged External Portal login. Same pattern as
  // useAttorneyDashboardStats.
  const loadData = useCallback(async () => {
    if (!user) return;
    // Wait for the link-status check above to actually resolve before
    // deciding anything — running this while it's still "checking" was
    // showing an empty/not-linked state for a beat and then swapping to
    // the real data once the real status came in.
    if (linkStatus === 'checking') return;
    setLoading(true);
    try {
      // Not linked to any firm at all — nothing to show (security:
      // never fall back to all data).
      if (linkStatus === 'not_linked') {
        setClaimants([]);
        setLoading(false);
        return;
      }

      // RLS-scoped: no `.in('referring_attorney_id', ...)` filter needed
      // or wanted — the database itself returns only the rows this
      // signed-in person is allowed to see.
      const { data: claimantsData, error: claimantsErr } = await supabase
        .from('claimants')
        .select('id, first_name, last_name, auto_id, referring_attorney_id, created_at');
      if (claimantsErr) throw claimantsErr;

      const claimantIds = (claimantsData || []).map(c => c.id);
      if (claimantIds.length === 0) {
        setClaimants([]);
        setLoading(false);
        return;
      }

      // Appointments + experts for those claimants
      const { data: appts } = await supabase
        .from('appointments')
        .select('id, claimant_id, appointment_date, case_status, matter_type, expert_id, updated_at')
        .in('claimant_id', claimantIds)
        .is('deleted_at', null);

      const apptIds = (appts || []).map(a => a.id);
      const expertIds = Array.from(new Set((appts || []).map(a => a.expert_id).filter(Boolean)));

      const [{ data: experts }, { data: reports }, { data: docs }] = await Promise.all([
        expertIds.length
          ? supabase.from('medical_experts').select('id, expert_type').in('id', expertIds)
          : Promise.resolve({ data: [] as any[] }),
        apptIds.length
          ? supabase
              .from('expert_reports')
              .select('id, appointment_id, report_status, report_submitted_date, report_due_date')
              .in('appointment_id', apptIds)
          : Promise.resolve({ data: [] as any[] }),
        apptIds.length
          ? supabase
              .from('documents')
              .select('appointment_id, file_path, document_type, upload_date')
              .in('appointment_id', apptIds)
              .ilike('document_type', '%report%')
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const expertMap = new Map<string, string>(
        (experts || []).map((e: any) => [e.id, e.expert_type as string])
      );
      const reportMap = new Map<string, any>();
      (reports || []).forEach((r: any) => reportMap.set(r.appointment_id, r));
      const docMap = new Map<string, string>();
      (docs || []).forEach((d: any) => {
        if (!docMap.has(d.appointment_id)) docMap.set(d.appointment_id, d.file_path);
      });

      // Build per-claimant cases
      const result: ClaimantCase[] = (claimantsData || []).map(cl => {
        const myAppts = (appts || []).filter(a => a.claimant_id === cl.id);
        const assessmentRows: AssessmentRow[] = myAppts.map(a => {
          const r = reportMap.get(a.id);
          return {
            appointment_id: a.id,
            appointment_date: a.appointment_date,
            case_status: a.case_status,
            matter_type: a.matter_type,
            expert_type: expertMap.get(a.expert_id) || 'Unknown',
            report_status: r?.report_status || null,
            report_submitted_date: r?.report_submitted_date || null,
            report_due_date: r?.report_due_date || null,
            report_id: r?.id,
            report_file_path: docMap.get(a.id) || null,
          };
        });

        const reportsRequired = assessmentRows.length;
        const reportsReceived = assessmentRows.filter(a => isReportReceived(a.report_status)).length;
        const reportsOutstanding = reportsRequired - reportsReceived;
        const { stage, pct } = computeStage(assessmentRows);
        const hasOverdue = assessmentRows.some(a => isReportOverdue(a.report_due_date, a.report_status));

        const lastUpdatedDates = [
          cl.created_at,
          ...myAppts.map(a => a.updated_at).filter(Boolean),
          ...assessmentRows.map(a => a.report_submitted_date).filter(Boolean) as string[],
        ];
        const lastUpdated = lastUpdatedDates.sort().pop() || cl.created_at;

        return {
          claimantId: cl.id,
          claimantAutoId: cl.auto_id || '',
          claimantName: `${cl.first_name || ''} ${cl.last_name || ''}`.trim() || 'Unknown',
          matterType: assessmentRows.find(a => a.matter_type)?.matter_type || null,
          lastUpdated,
          assessments: assessmentRows,
          reportsRequired,
          reportsReceived,
          reportsOutstanding,
          stage,
          progressPct: pct,
          hasOverdue,
        };
      });

      setClaimants(result);
    } catch (err) {
      console.error('[AttorneyCaseStatus] load failed', err);
      toast({ title: 'Error', description: 'Failed to load case data.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [user, linkStatus, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime subscriptions — reflect admin changes immediately
  useEffect(() => {
    if (linkStatus !== 'linked') return;
    const channel = supabase
      .channel('attorney-case-status-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expert_reports' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'claimants' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'aod_documents' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'short_term_agreements' }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [linkStatus, loadData]);

  // Dashboard summary cards
  const summary = useMemo(() => {
    const activeClaimants = claimants.filter(c => !isCaseClosed(c)).length;
    const closedClaimants = claimants.filter(c => isCaseClosed(c)).length;
    const totalAssessments = claimants.reduce((s, c) => s + c.reportsRequired, 0);
    const totalReportsReceived = claimants.reduce((s, c) => s + c.reportsReceived, 0);
    const totalOutstanding = claimants.reduce((s, c) => s + c.reportsOutstanding, 0);
    return { activeClaimants, closedClaimants, totalAssessments, totalReportsReceived, totalOutstanding };
  }, [claimants]);

  // Notifications (derived alerts)
  const notifications = useMemo(() => {
    const items: { id: string; type: string; title: string; message: string; tone: 'success' | 'warning' | 'destructive' | 'info'; claimantKey: string }[] = [];
    claimants.forEach(c => {
      if (c.reportsRequired > 0 && c.reportsReceived === c.reportsRequired) {
        items.push({
          id: `complete-${c.claimantId}`,
          type: 'complete',
          title: 'All reports completed',
          message: `${c.claimantName} — ${c.reportsReceived}/${c.reportsRequired} reports received`,
          tone: 'success',
          claimantKey: c.claimantId,
        });
      }
      c.assessments.forEach(a => {
        if (isReportReceived(a.report_status) && a.report_submitted_date) {
          const days = differenceInDays(new Date(), new Date(a.report_submitted_date));
          if (days <= 3) {
            items.push({
              id: `new-${a.appointment_id}`,
              type: 'new_report',
              title: 'New report uploaded',
              message: `${c.claimantName} — ${formatExpertType(a.expert_type)} report uploaded ${formatDistanceToNow(new Date(a.report_submitted_date), { addSuffix: true })}`,
              tone: 'info',
              claimantKey: c.claimantId,
            });
          }
        }
        if (isReportOverdue(a.report_due_date, a.report_status)) {
          const days = differenceInDays(new Date(), new Date(a.report_due_date!));
          items.push({
            id: `overdue-${a.appointment_id}`,
            type: 'overdue',
            title: 'Report overdue',
            message: `${c.claimantName} — ${formatExpertType(a.expert_type)} report ${days} day(s) overdue`,
            tone: 'destructive',
            claimantKey: c.claimantId,
          });
        }
      });
    });
    return items.slice(0, 20);
  }, [claimants]);

  // Filtered & sorted list
  const filtered = useMemo(() => {
    let list = [...claimants];

    if (activeQuickFilter === 'active') list = list.filter(c => !isCaseClosed(c));
    if (activeQuickFilter === 'closed') list = list.filter(c => isCaseClosed(c));
    if (activeQuickFilter === 'outstanding') list = list.filter(c => c.reportsOutstanding > 0);
    if (activeQuickFilter === 'received') list = list.filter(c => c.reportsReceived > 0);

    if (statusFilter === 'active') list = list.filter(c => !isCaseClosed(c));
    if (statusFilter === 'closed') list = list.filter(c => isCaseClosed(c));
    if (statusFilter === 'reports_outstanding') list = list.filter(c => c.reportsOutstanding > 0);
    if (statusFilter === 'litigation_ready') list = list.filter(
      c => c.stage === 'Closed' || (c.reportsRequired > 0 && c.reportsReceived === c.reportsRequired)
    );

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.claimantName.toLowerCase().includes(q) ||
        c.claimantAutoId.toLowerCase().includes(q) ||
        normalizeClaimType(c.matterType).toLowerCase().includes(q)
      );
    }

    if (sortBy === 'newest') list.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
    if (sortBy === 'oldest') list.sort((a, b) => new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime());
    if (sortBy === 'most_outstanding') list.sort((a, b) => b.reportsOutstanding - a.reportsOutstanding);

    return list;
  }, [claimants, activeQuickFilter, statusFilter, search, sortBy]);

  const selectedClaimant = useMemo(
    () => claimants.find(c => c.claimantId === selectedClaimantId) || null,
    [claimants, selectedClaimantId]
  );

  const openClaimant = (id: string) => {
    setSelectedClaimantId(id);
    setView('detail');
  };

  // Download single report (only for the linked attorney's own files)
  const handleDownloadReport = useCallback(async (filePath: string | null | undefined, fileName: string) => {
    if (!filePath) {
      toast({ title: 'Unavailable', description: 'No report file linked yet.', variant: 'destructive' });
      return;
    }
    try {
      if (filePath.startsWith('http')) {
        window.open(filePath, '_blank');
        return;
      }
      const buckets = ['expert-documents', 'documents', 'attorney-documents'];
      for (const b of buckets) {
        const { data, error } = await supabase.storage.from(b).download(filePath);
        if (data && !error) {
          const url = URL.createObjectURL(data);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          a.click();
          URL.revokeObjectURL(url);
          toast({ title: 'Downloaded', description: fileName });
          return;
        }
      }
      toast({ title: 'Not found', description: 'Could not locate report file.', variant: 'destructive' });
    } catch {
      toast({ title: 'Error', description: 'Download failed.', variant: 'destructive' });
    }
  }, [toast]);

  // Status pills (tone-driven, same vocabulary as PortalPill everywhere else)
  const STAGE_PILL_TONE: Record<Stage, PortalPillTone> = {
    Closed: 'success',
    Litigation: 'teal',
    Reports: 'teal',
    Assessment: 'warning',
    Booking: 'neutral',
    Referral: 'neutral',
  };
  const stageBadge = (stage: Stage) => <PortalPill tone={STAGE_PILL_TONE[stage]}>{stage}</PortalPill>;

  const assessmentStatusBadge = (a: AssessmentRow) => {
    const s = (a.case_status || '').toLowerCase();
    if (['assessed', 'completed', 'done'].includes(s) || isReportReceived(a.report_status))
      return <PortalPill tone="success">Assessed</PortalPill>;
    if (s === 'scheduled' || s === 'confirmed')
      return <PortalPill tone="teal">Scheduled</PortalPill>;
    if (s === 'rescheduled') return <PortalPill tone="warning">Rescheduled</PortalPill>;
    if (s === 'missed' || s === 'cancelled')
      return <PortalPill tone="destructive">{s === 'missed' ? 'Missed' : 'Cancelled'}</PortalPill>;
    return <PortalPill>Pending</PortalPill>;
  };

  const reportStatusBadge = (a: AssessmentRow) => {
    if (isReportReceived(a.report_status))
      return <PortalPill tone="success"><CheckCircle2 className="h-3 w-3" />Received</PortalPill>;
    if (isReportOverdue(a.report_due_date, a.report_status))
      return <PortalPill tone="destructive"><AlertTriangle className="h-3 w-3" />Overdue</PortalPill>;
    if (a.report_status)
      return <PortalPill tone="teal">{a.report_status}</PortalPill>;
    return <PortalPill tone="warning">Outstanding</PortalPill>;
  };

  if (linkStatus === 'checking') {
    return (
      <AttorneyPortalLayout>
        <PortalPage>
          <PortalHeader eyebrow="Attorney Portal" title="View Case Status" icon={Activity} />
          <PortalLoadingState label="Checking your account…" />
        </PortalPage>
      </AttorneyPortalLayout>
    );
  }

  if (linkStatus === 'not_linked') {
    return (
      <AttorneyPortalLayout>
        <PortalPage>
          <PortalHeader eyebrow="Attorney Portal" title="View Case Status" icon={Activity} />
          <AttorneyNotLinkedState description="Your account isn't linked to a firm's referrals yet, so there's nothing to show here. Contact an administrator or get help below." />
        </PortalPage>
      </AttorneyPortalLayout>
    );
  }

  return (
    <AttorneyPortalLayout>
      <Helmet>
        <title>View Case Status — Attorney Portal</title>
        <meta name="description" content="Track claimant case status, assessments, reports and progress in real time." />
      </Helmet>

      <PortalPage>
        <PortalHeader
          eyebrow="Attorney Portal"
          title="View Case Status"
          description="Real-time view of your claimants, assessments, reports and litigation readiness."
          icon={Activity}
          actions={<SyncStatus loading={loading} onRefresh={loadData} label="Live data" />}
        />

        {view === 'dashboard' && (
          <>
            {/* KPI ledger — one bordered panel, matches Dashboard/My Cases/Appointments */}
            <PortalStatStrip
              loading={loading}
              tiles={[
                {
                  label: 'Active Claimants', value: summary.activeClaimants, icon: Users,
                  hint: activeQuickFilter === 'active' ? 'Filter on' : undefined,
                },
                {
                  label: 'Closed Claimants', value: summary.closedClaimants, icon: CheckCircle2,
                  hint: activeQuickFilter === 'closed' ? 'Filter on' : undefined,
                },
                { label: 'Assessments Booked', value: summary.totalAssessments, icon: Calendar },
                {
                  label: 'Reports Received', value: summary.totalReportsReceived, icon: FileCheck,
                  hint: activeQuickFilter === 'received' ? 'Filter on' : undefined,
                },
                {
                  label: 'Reports Outstanding', value: summary.totalOutstanding, icon: AlertTriangle,
                  urgent: summary.totalOutstanding > 0,
                  hint: activeQuickFilter === 'outstanding' ? 'Filter on' : undefined,
                },
              ]}
            />
            {/* Quick filter toggles — same numbers as the strip above, clickable */}
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'active', label: 'Active' },
                { key: 'closed', label: 'Closed' },
                { key: 'received', label: 'Reports Received' },
                { key: 'outstanding', label: 'Reports Outstanding' },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setActiveQuickFilter(activeQuickFilter === f.key ? null : f.key)}
                  className={cn(
                    'border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide transition-colors',
                    activeQuickFilter === f.key
                      ? 'border-[#00BAAD]/50 bg-[#00BAAD]/10 text-[#00BAAD]'
                      : 'border-black/10 text-slate-500 hover:border-black/25 hover:text-black'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Notifications */}
            {notifications.length > 0 && (
              <PortalCard>
                <PortalCardHeader
                  icon={Bell}
                  title="Recent Alerts"
                  actions={<PortalPill tone="teal">{notifications.length}</PortalPill>}
                />
                <PortalCardBody className="max-h-64 space-y-2 overflow-y-auto">
                  {notifications.map(n => (
                    <button
                      key={n.id}
                      onClick={() => openClaimant(n.claimantKey)}
                      className={cn(
                        'flex w-full items-start gap-3 border px-3 py-2.5 text-left transition-colors hover:bg-black/[0.02]',
                        n.tone === 'destructive' ? 'border-destructive/30'
                        : n.tone === 'success' ? 'border-success/30'
                        : n.tone === 'warning' ? 'border-warning/30'
                        : 'border-black/10'
                      )}
                    >
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border border-black/10 bg-black/[0.03]">
                        {n.tone === 'destructive' && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                        {n.tone === 'success' && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
                        {n.tone === 'warning' && <Clock className="h-3.5 w-3.5 text-warning" />}
                        {n.tone === 'info' && <FileText className="h-3.5 w-3.5" style={{ color: BRAND_TEAL }} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-black">{n.title}</p>
                        <p className="truncate text-xs text-slate-500">{n.message}</p>
                      </div>
                      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
                    </button>
                  ))}
                </PortalCardBody>
              </PortalCard>
            )}

            {/* Search & Filters */}
            <PortalCard>
              <PortalCardBody>
                <div className="flex flex-col gap-3 md:flex-row">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="Search by claimant name or case reference…"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className={cn(FIELD_CLASS, 'pl-9')}
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                    <SelectTrigger className={cn(FIELD_CLASS, 'w-full md:w-[200px]')}>
                      <Filter className="mr-2 h-4 w-4 text-slate-400" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Cases</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                      <SelectItem value="reports_outstanding">Reports Outstanding</SelectItem>
                      <SelectItem value="litigation_ready">Ready for Litigation</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                    <SelectTrigger className={cn(FIELD_CLASS, 'w-full md:w-[200px]')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest First</SelectItem>
                      <SelectItem value="oldest">Oldest First</SelectItem>
                      <SelectItem value="most_outstanding">Most Reports Outstanding</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </PortalCardBody>
            </PortalCard>

            {/* Claimant Table */}
            <PortalCard>
              <PortalCardHeader
                icon={Users}
                title={`Claimants (${filtered.length})`}
                description="Click a row to open the claimant file"
              />
              <PortalCardBody className={loading || filtered.length === 0 ? 'p-0' : 'p-0'}>
                {loading ? (
                  <PortalLoadingState label="Loading claimants…" />
                ) : filtered.length === 0 ? (
                  <PortalEmptyState icon={Users} title="No claimants match your filters" />
                ) : (
                  <div className="overflow-x-auto">
                    <Table className="text-xs [&_td]:px-3 [&_td]:py-2.5 [&_th]:h-9 [&_th]:px-3 [&_th]:text-[11px]">
                      <TableHeader className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_theme(colors.black/10%)]">
                        <TableRow>
                          <TableHead>Claimant Name</TableHead>
                          <TableHead>Case Reference</TableHead>
                          <TableHead>Claim Type</TableHead>
                          <TableHead>Current Status</TableHead>
                          <TableHead className="text-center">Assessments Completed</TableHead>
                          <TableHead className="text-center">Reports (Received / Outstanding)</TableHead>
                          <TableHead>Last Updated</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map(c => {
                          const completed = c.assessments.filter(a =>
                            ['assessed', 'completed', 'done'].includes((a.case_status || '').toLowerCase())
                            || isReportReceived(a.report_status)
                          ).length;
                          return (
                            <TableRow
                              key={c.claimantId}
                              className="cursor-pointer hover:bg-black/[0.02]"
                              onClick={() => openClaimant(c.claimantId)}
                            >
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <User className="h-3.5 w-3.5 text-slate-400" />
                                  <span className="font-medium text-black">{c.claimantName}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="font-mono text-[11px] text-slate-500">
                                  {c.claimantAutoId || '—'}
                                </span>
                              </TableCell>
                              <TableCell className="text-slate-600">{normalizeClaimType(c.matterType)}</TableCell>
                              <TableCell>{stageBadge(c.stage)}</TableCell>
                              <TableCell className="text-center">
                                <span className="font-medium text-black">{completed}</span>
                                <span className="text-slate-400"> / {c.assessments.length}</span>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="font-medium text-success">{c.reportsReceived}</span>
                                <span className="text-slate-400"> / </span>
                                <span className={c.reportsOutstanding > 0 ? 'font-medium text-destructive' : 'text-slate-400'}>
                                  {c.reportsOutstanding}
                                </span>
                              </TableCell>
                              <TableCell className="text-[11px] text-slate-500">
                                {c.lastUpdated ? format(new Date(c.lastUpdated), 'dd MMM yyyy') : '—'}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button size="sm" variant="ghost" className="rounded-none">
                                  Open <ChevronRight className="ml-1 h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </PortalCardBody>
            </PortalCard>
          </>
        )}

        {view === 'detail' && selectedClaimant && (
          <ClaimantDetail
            claimant={selectedClaimant}
            onBack={() => { setView('dashboard'); setSelectedClaimantId(null); }}
            onDownload={handleDownloadReport}
            stageBadge={stageBadge}
            assessmentStatusBadge={assessmentStatusBadge}
            reportStatusBadge={reportStatusBadge}
          />
        )}
      </PortalPage>
    </AttorneyPortalLayout>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Claimant Detail
// ─────────────────────────────────────────────────────────────────────
interface DetailProps {
  claimant: ClaimantCase;
  onBack: () => void;
  onDownload: (path: string | null | undefined, fileName: string) => void;
  stageBadge: (s: Stage) => React.ReactNode;
  assessmentStatusBadge: (a: AssessmentRow) => React.ReactNode;
  reportStatusBadge: (a: AssessmentRow) => React.ReactNode;
}

const stageDotClass = (stage: Stage, current: Stage) => {
  const currentIdx = STAGES.indexOf(current);
  const idx = STAGES.indexOf(stage);
  if (idx < currentIdx) return 'border-success bg-success text-white';
  if (idx === currentIdx) return 'border-[#00BAAD] bg-[#00BAAD] text-white';
  return 'border-black/15 bg-white text-slate-400';
};

type DetailTab = 'overview' | 'assessments' | 'reports' | 'tracker';

const ClaimantDetail: React.FC<DetailProps> = ({
  claimant, onBack, onDownload, stageBadge, assessmentStatusBadge, reportStatusBadge,
}) => {
  const [tab, setTab] = useState<DetailTab>('overview');

  const TAB_ITEMS: { key: DetailTab; label: string; icon: typeof User }[] = [
    { key: 'overview', label: 'Overview', icon: User },
    { key: 'assessments', label: 'Assessments', icon: Stethoscope },
    { key: 'reports', label: 'Reports', icon: FileText },
    { key: 'tracker', label: 'Live Tracker', icon: Activity },
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      <Button variant="ghost" onClick={onBack} className="gap-2 rounded-none px-0 hover:bg-transparent hover:text-[#00BAAD]">
        <ArrowLeft className="h-4 w-4" /> Back to Claimants
      </Button>

      <PortalCard>
        <PortalCardHeader
          icon={User}
          title={claimant.claimantName}
          description={
            <span className="space-x-2">
              <span className="font-mono">{claimant.claimantAutoId || 'No reference'}</span>
              <span>•</span>
              <span>{normalizeClaimType(claimant.matterType)}</span>
            </span>
          }
          actions={stageBadge(claimant.stage)}
        />
        <PortalCardBody>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>Workflow progress</span>
              <span className="font-medium text-black">{claimant.progressPct}%</span>
            </div>
            <Progress value={claimant.progressPct} className="h-1.5 rounded-none" />
          </div>
        </PortalCardBody>
      </PortalCard>

      {/* Tabs — flat underline style, matches the rest of the portal */}
      <div className="flex flex-wrap gap-1 border-b border-black/10">
        {TAB_ITEMS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors',
              tab === t.key
                ? 'border-[#00BAAD] text-[#00BAAD]'
                : 'border-transparent text-slate-500 hover:text-black'
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <PortalCard>
          <PortalCardHeader title="Case Summary" />
          <PortalCardBody className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Field label="Claimant" value={claimant.claimantName} />
            <Field label="Case Reference" value={claimant.claimantAutoId || '—'} />
            <Field label="Claim Type" value={normalizeClaimType(claimant.matterType)} />
            <Field label="Current Stage" value={claimant.stage} />
            <Field label="Assessments Booked" value={claimant.reportsRequired.toString()} />
            <Field label="Reports Received" value={claimant.reportsReceived.toString()} />
            <Field label="Reports Outstanding" value={claimant.reportsOutstanding.toString()} />
            <Field label="Last Updated" value={claimant.lastUpdated ? format(new Date(claimant.lastUpdated), 'dd MMM yyyy') : '—'} />
          </PortalCardBody>
        </PortalCard>
      )}

      {/* Assessments */}
      {tab === 'assessments' && (
        <PortalCard>
          <PortalCardHeader icon={Stethoscope} title={`Expert Assessments (${claimant.assessments.length})`} />
          <PortalCardBody className="p-0">
            <Table className="text-xs [&_td]:px-3 [&_td]:py-2.5 [&_th]:h-9 [&_th]:px-3 [&_th]:text-[11px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Expert Type</TableHead>
                  <TableHead>Appointment Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claimant.assessments.map(a => (
                  <TableRow key={a.appointment_id}>
                    <TableCell className="font-medium text-black">{formatExpertType(a.expert_type)}</TableCell>
                    <TableCell className="text-slate-500">
                      {a.appointment_date ? format(new Date(a.appointment_date), 'dd MMM yyyy') : '—'}
                    </TableCell>
                    <TableCell>{assessmentStatusBadge(a)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </PortalCardBody>
        </PortalCard>
      )}

      {/* Reports */}
      {tab === 'reports' && (
        <>
          <PortalStatStrip
            className="sm:grid-cols-3 lg:grid-cols-3"
            tiles={[
              { label: 'Total Reports Required', value: claimant.reportsRequired, icon: FileText },
              { label: 'Reports Received', value: claimant.reportsReceived, icon: CheckCircle2 },
              { label: 'Reports Outstanding', value: claimant.reportsOutstanding, icon: AlertTriangle, urgent: claimant.reportsOutstanding > 0 },
            ]}
          />
          <PortalCard>
            <PortalCardHeader icon={FileText} title="Reports" />
            <PortalCardBody className="p-0">
              <Table className="text-xs [&_td]:px-3 [&_td]:py-2.5 [&_th]:h-9 [&_th]:px-3 [&_th]:text-[11px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Expert / Specialty</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Received Date</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {claimant.assessments.map(a => {
                    const overdue = isReportOverdue(a.report_due_date, a.report_status);
                    const received = isReportReceived(a.report_status);
                    return (
                      <TableRow key={a.appointment_id} className={overdue ? 'bg-destructive/5' : ''}>
                        <TableCell className="font-medium text-black">{formatExpertType(a.expert_type)}</TableCell>
                        <TableCell>{reportStatusBadge(a)}</TableCell>
                        <TableCell className={overdue ? 'font-medium text-destructive' : 'text-slate-500'}>
                          {a.report_due_date ? format(new Date(a.report_due_date), 'dd MMM yyyy') : '—'}
                        </TableCell>
                        <TableCell className="text-slate-500">
                          {a.report_submitted_date ? format(new Date(a.report_submitted_date), 'dd MMM yyyy') : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {received && a.report_file_path ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-none"
                              onClick={() => onDownload(a.report_file_path, `${claimant.claimantName}_${formatExpertType(a.expert_type)}.pdf`)}
                            >
                              <Download className="mr-1 h-3 w-3" /> Download
                            </Button>
                          ) : (
                            <span className="text-[11px] text-slate-400">{received ? 'No file' : 'Pending'}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </PortalCardBody>
          </PortalCard>
        </>
      )}

      {/* Live Tracker */}
      {tab === 'tracker' && (
        <PortalCard>
          <PortalCardHeader
            icon={Activity}
            title="Live Status Tracker"
            description="Visual progression: Referral → Booking → Assessment → Reports → Litigation → Closed"
          />
          <PortalCardBody>
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
              {STAGES.map((s, i) => {
                const isCurrent = s === claimant.stage;
                const showRed = isCurrent && claimant.hasOverdue && (s === 'Reports' || s === 'Assessment');
                return (
                  <React.Fragment key={s}>
                    <div className="flex min-w-[90px] flex-col items-center gap-1.5">
                      <div className={cn(
                        'flex h-9 w-9 items-center justify-center border-2 text-sm font-semibold',
                        showRed ? 'border-destructive bg-destructive text-white' : stageDotClass(s, claimant.stage)
                      )}>
                        {STAGES.indexOf(s) < STAGES.indexOf(claimant.stage) ? <CheckCircle2 className="h-4 w-4" /> :
                          showRed ? <AlertTriangle className="h-4 w-4" /> : i + 1}
                      </div>
                      <span className={cn('text-center text-[11px]', isCurrent ? 'font-semibold text-black' : 'text-slate-500')}>
                        {s}
                      </span>
                    </div>
                    {i < STAGES.length - 1 && (
                      <div className={cn(
                        'h-0.5 min-w-[20px] flex-1',
                        STAGES.indexOf(s) < STAGES.indexOf(claimant.stage) ? 'bg-success' : 'bg-black/10'
                      )} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            <Separator className="my-6 bg-black/10" />

            <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 bg-success" />
                <span className="text-slate-500">Completed</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5" style={{ backgroundColor: BRAND_TEAL }} />
                <span className="text-slate-500">Current</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 bg-destructive" />
                <span className="text-slate-500">Delayed / Overdue</span>
              </div>
            </div>
          </PortalCardBody>
        </PortalCard>
      )}
    </div>
  );
};

const Field: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-[11px] text-slate-500">{label}</p>
    <p className="text-sm font-medium text-black">{value}</p>
  </div>
);

export default AttorneyCaseStatus;
