import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { AttorneyPortalLayout } from '@/components/portal/AttorneyPortalLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Users, CheckCircle2, Calendar, FileText, AlertTriangle,
  Search, Filter, ArrowLeft, User, Clock, Download, Bell,
  Activity, Stethoscope, Loader2, ChevronRight, FileCheck
} from 'lucide-react';
import { formatExpertType } from '@/utils/expertTypeMapping';
import { format, formatDistanceToNow, differenceInDays } from 'date-fns';

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
// Stat Card
// ─────────────────────────────────────────────────────────────────────
const StatCard: React.FC<{
  label: string;
  value: number | string;
  icon: React.ReactNode;
  tone?: 'primary' | 'success' | 'warning' | 'destructive' | 'info';
  onClick?: () => void;
  active?: boolean;
}> = ({ label, value, icon, tone = 'primary', onClick, active }) => {
  const tones: Record<string, string> = {
    primary: 'border-primary/30 hover:border-primary text-primary',
    success: 'border-success/30 hover:border-success text-success',
    warning: 'border-warning/30 hover:border-warning text-warning',
    destructive: 'border-destructive/30 hover:border-destructive text-destructive',
    info: 'border-info/30 hover:border-info text-info',
  };
  return (
    <Card
      onClick={onClick}
      className={`cursor-pointer transition-all bg-card ${tones[tone]} ${active ? 'ring-2 ring-offset-2 ring-primary' : ''}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            <p className="text-2xl font-bold mt-1 text-foreground">{value}</p>
          </div>
          <div className="shrink-0 opacity-80">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
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
  const [attorneyIds, setAttorneyIds] = useState<string[]>([]);

  // 1. Resolve which referring attorneys this user is linked to
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('user_attorney_links')
        .select('referring_attorney_id')
        .eq('user_id', user.id);
      setAttorneyIds((data || []).map(r => r.referring_attorney_id));
    })();
  }, [user]);

  // 2. Load all attorney-scoped claimants + appointments + reports + report docs
  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // If user has no attorney links yet, show empty (security: never fall back to all data)
      if (attorneyIds.length === 0) {
        setClaimants([]);
        setLoading(false);
        return;
      }

      // Pull claimants for the linked attorneys
      const { data: claimantsData, error: claimantsErr } = await supabase
        .from('claimants')
        .select('id, first_name, last_name, auto_id, referring_attorney_id, created_at')
        .in('referring_attorney_id', attorneyIds);
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
  }, [user, attorneyIds, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime subscriptions — reflect admin changes immediately
  useEffect(() => {
    if (attorneyIds.length === 0) return;
    const channel = supabase
      .channel('attorney-case-status-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expert_reports' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'claimants' }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [attorneyIds, loadData]);

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

  // Status badges
  const stageBadge = (stage: Stage) => {
    const colors: Record<string, string> = {
      Closed: 'bg-success/10 text-success border-success/30',
      Litigation: 'bg-info/10 text-info border-info/30',
      Reports: 'bg-primary/10 text-primary border-primary/30',
      Assessment: 'bg-warning/10 text-warning border-warning/30',
      Booking: 'bg-muted text-muted-foreground border-border',
      Referral: 'bg-muted text-muted-foreground border-border',
    };
    return <Badge variant="outline" className={colors[stage]}>{stage}</Badge>;
  };

  const assessmentStatusBadge = (a: AssessmentRow) => {
    const s = (a.case_status || '').toLowerCase();
    if (['assessed', 'completed', 'done'].includes(s) || isReportReceived(a.report_status))
      return <Badge className="bg-success/10 text-success border-success/30">Assessed</Badge>;
    if (s === 'scheduled' || s === 'confirmed')
      return <Badge className="bg-info/10 text-info border-info/30">Scheduled</Badge>;
    if (s === 'rescheduled') return <Badge className="bg-warning/10 text-warning border-warning/30">Rescheduled</Badge>;
    if (s === 'missed' || s === 'cancelled')
      return <Badge variant="destructive">{s === 'missed' ? 'Missed' : 'Cancelled'}</Badge>;
    return <Badge variant="outline">Pending</Badge>;
  };

  const reportStatusBadge = (a: AssessmentRow) => {
    if (isReportReceived(a.report_status))
      return <Badge className="bg-success/10 text-success border-success/30"><CheckCircle2 className="h-3 w-3 mr-1" />Received</Badge>;
    if (isReportOverdue(a.report_due_date, a.report_status))
      return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Overdue</Badge>;
    if (a.report_status)
      return <Badge className="bg-info/10 text-info border-info/30">{a.report_status}</Badge>;
    return <Badge variant="outline">Outstanding</Badge>;
  };

  return (
    <AttorneyPortalLayout>
      <Helmet>
        <title>View Case Status — Attorney Portal</title>
        <meta name="description" content="Track claimant case status, assessments, reports and progress in real time." />
      </Helmet>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Activity className="h-7 w-7 text-primary" />
              View Case Status
            </h1>
            <p className="text-muted-foreground mt-1">
              Real-time view of your claimants, assessments, reports and litigation readiness.
            </p>
          </div>
          <Button variant="outline" onClick={() => loadData()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Activity className="h-4 w-4 mr-2" />}
            Refresh
          </Button>
        </div>

        {view === 'dashboard' && (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <StatCard
                label="Active Claimants"
                value={summary.activeClaimants}
                icon={<Users className="h-5 w-5" />}
                tone="primary"
                active={activeQuickFilter === 'active'}
                onClick={() => setActiveQuickFilter(activeQuickFilter === 'active' ? null : 'active')}
              />
              <StatCard
                label="Closed Claimants"
                value={summary.closedClaimants}
                icon={<CheckCircle2 className="h-5 w-5" />}
                tone="success"
                active={activeQuickFilter === 'closed'}
                onClick={() => setActiveQuickFilter(activeQuickFilter === 'closed' ? null : 'closed')}
              />
              <StatCard
                label="Assessments Booked"
                value={summary.totalAssessments}
                icon={<Calendar className="h-5 w-5" />}
                tone="info"
              />
              <StatCard
                label="Reports Received"
                value={summary.totalReportsReceived}
                icon={<FileCheck className="h-5 w-5" />}
                tone="success"
                active={activeQuickFilter === 'received'}
                onClick={() => setActiveQuickFilter(activeQuickFilter === 'received' ? null : 'received')}
              />
              <StatCard
                label="Outstanding Reports"
                value={summary.totalOutstanding}
                icon={<AlertTriangle className="h-5 w-5" />}
                tone={summary.totalOutstanding > 0 ? 'warning' : 'primary'}
                active={activeQuickFilter === 'outstanding'}
                onClick={() => setActiveQuickFilter(activeQuickFilter === 'outstanding' ? null : 'outstanding')}
              />
            </div>

            {/* Notifications */}
            {notifications.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bell className="h-4 w-4 text-primary" />
                    Recent Alerts
                    <Badge variant="secondary" className="ml-1">{notifications.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 max-h-64 overflow-y-auto">
                  {notifications.map(n => (
                    <button
                      key={n.id}
                      onClick={() => openClaimant(n.claimantKey)}
                      className={`w-full text-left flex items-start gap-3 p-3 rounded-lg border transition-colors hover:bg-muted/50 ${
                        n.tone === 'destructive' ? 'border-destructive/30 bg-destructive/5'
                        : n.tone === 'success' ? 'border-success/30 bg-success/5'
                        : n.tone === 'warning' ? 'border-warning/30 bg-warning/5'
                        : 'border-info/30 bg-info/5'
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {n.tone === 'destructive' && <AlertTriangle className="h-4 w-4 text-destructive" />}
                        {n.tone === 'success' && <CheckCircle2 className="h-4 w-4 text-success" />}
                        {n.tone === 'warning' && <Clock className="h-4 w-4 text-warning" />}
                        {n.tone === 'info' && <FileText className="h-4 w-4 text-info" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{n.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{n.message}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Filters */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by claimant name or case reference..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                    <SelectTrigger className="w-full md:w-[200px]">
                      <Filter className="h-4 w-4 mr-2" />
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
                    <SelectTrigger className="w-full md:w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest First</SelectItem>
                      <SelectItem value="oldest">Oldest First</SelectItem>
                      <SelectItem value="most_outstanding">Most Reports Outstanding</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Claimant Table */}
            <Card>
              <CardHeader>
                <CardTitle>Claimants ({filtered.length})</CardTitle>
                <CardDescription>Click a row to open the claimant file</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No claimants match your filters.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
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
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => openClaimant(c.claimantId)}
                            >
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">{c.claimantName}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="font-mono text-xs text-muted-foreground">
                                  {c.claimantAutoId || '—'}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm">{normalizeClaimType(c.matterType)}</span>
                              </TableCell>
                              <TableCell>{stageBadge(c.stage)}</TableCell>
                              <TableCell className="text-center">
                                <span className="font-medium">{completed}</span>
                                <span className="text-muted-foreground"> / {c.assessments.length}</span>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="text-success font-medium">{c.reportsReceived}</span>
                                <span className="text-muted-foreground"> / </span>
                                <span className={c.reportsOutstanding > 0 ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                                  {c.reportsOutstanding}
                                </span>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {c.lastUpdated ? format(new Date(c.lastUpdated), 'dd MMM yyyy') : '—'}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button size="sm" variant="ghost">
                                  Open <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
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
      </div>
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

const stageColor = (stage: Stage, current: Stage) => {
  const currentIdx = STAGES.indexOf(current);
  const idx = STAGES.indexOf(stage);
  if (idx < currentIdx) return 'bg-success text-success-foreground border-success';
  if (idx === currentIdx) return 'bg-primary text-primary-foreground border-primary';
  return 'bg-muted text-muted-foreground border-border';
};

const ClaimantDetail: React.FC<DetailProps> = ({
  claimant, onBack, onDownload, stageBadge, assessmentStatusBadge, reportStatusBadge,
}) => {
  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Back to Claimants
      </Button>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <User className="h-6 w-6 text-primary" />
                {claimant.claimantName}
              </CardTitle>
              <CardDescription className="mt-1 space-x-3">
                <span className="font-mono">{claimant.claimantAutoId || 'No reference'}</span>
                <span>•</span>
                <span>{normalizeClaimType(claimant.matterType)}</span>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {stageBadge(claimant.stage)}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Workflow progress</span>
              <span>{claimant.progressPct}%</span>
            </div>
            <Progress value={claimant.progressPct} className="h-2" />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList className="grid w-full grid-cols-4 md:w-auto md:inline-flex">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="assessments">Assessments</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="tracker">Live Tracker</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Case Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Field label="Claimant" value={claimant.claimantName} />
              <Field label="Case Reference" value={claimant.claimantAutoId || '—'} />
              <Field label="Claim Type" value={normalizeClaimType(claimant.matterType)} />
              <Field label="Current Stage" value={claimant.stage} />
              <Field label="Assessments Booked" value={claimant.reportsRequired.toString()} />
              <Field label="Reports Received" value={claimant.reportsReceived.toString()} />
              <Field label="Reports Outstanding" value={claimant.reportsOutstanding.toString()} />
              <Field label="Last Updated" value={claimant.lastUpdated ? format(new Date(claimant.lastUpdated), 'dd MMM yyyy') : '—'} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Assessments */}
        <TabsContent value="assessments">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-primary" />
                Expert Assessments ({claimant.assessments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
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
                      <TableCell className="font-medium">{formatExpertType(a.expert_type)}</TableCell>
                      <TableCell>
                        {a.appointment_date ? format(new Date(a.appointment_date), 'dd MMM yyyy') : '—'}
                      </TableCell>
                      <TableCell>{assessmentStatusBadge(a)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports */}
        <TabsContent value="reports">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Card><CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Total Reports Required</p>
              <p className="text-2xl font-bold">{claimant.reportsRequired}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Reports Received</p>
              <p className="text-2xl font-bold text-success">{claimant.reportsReceived}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Reports Outstanding</p>
              <p className={`text-2xl font-bold ${claimant.reportsOutstanding > 0 ? 'text-destructive' : 'text-foreground'}`}>
                {claimant.reportsOutstanding}
              </p>
            </CardContent></Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Reports
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
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
                        <TableCell className="font-medium">{formatExpertType(a.expert_type)}</TableCell>
                        <TableCell>{reportStatusBadge(a)}</TableCell>
                        <TableCell className={overdue ? 'text-destructive font-medium' : ''}>
                          {a.report_due_date ? format(new Date(a.report_due_date), 'dd MMM yyyy') : '—'}
                        </TableCell>
                        <TableCell>
                          {a.report_submitted_date ? format(new Date(a.report_submitted_date), 'dd MMM yyyy') : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {received && a.report_file_path ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onDownload(a.report_file_path, `${claimant.claimantName}_${formatExpertType(a.expert_type)}.pdf`)}
                            >
                              <Download className="h-3 w-3 mr-1" /> Download
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">{received ? 'No file' : 'Pending'}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Live Tracker */}
        <TabsContent value="tracker">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Live Status Tracker
              </CardTitle>
              <CardDescription>
                Visual progression: Referral → Booking → Assessment → Reports → Litigation → Closed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
                {STAGES.map((s, i) => {
                  const cls = stageColor(s, claimant.stage);
                  const isCurrent = s === claimant.stage;
                  const showRed = isCurrent && claimant.hasOverdue && (s === 'Reports' || s === 'Assessment');
                  return (
                    <React.Fragment key={s}>
                      <div className="flex flex-col items-center gap-1 min-w-[90px]">
                        <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-semibold text-sm ${
                          showRed ? 'bg-destructive text-destructive-foreground border-destructive' : cls
                        }`}>
                          {STAGES.indexOf(s) < STAGES.indexOf(claimant.stage) ? <CheckCircle2 className="h-5 w-5" /> :
                            showRed ? <AlertTriangle className="h-5 w-5" /> : i + 1}
                        </div>
                        <span className={`text-xs text-center ${isCurrent ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                          {s}
                        </span>
                      </div>
                      {i < STAGES.length - 1 && (
                        <div className={`flex-1 h-0.5 min-w-[20px] ${
                          STAGES.indexOf(s) < STAGES.indexOf(claimant.stage) ? 'bg-success' : 'bg-border'
                        }`} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              <Separator className="my-6" />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-success" />
                  <span className="text-muted-foreground">Completed</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-primary" />
                  <span className="text-muted-foreground">Current</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-destructive" />
                  <span className="text-muted-foreground">Delayed / Overdue</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const Field: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-sm font-medium text-foreground">{value}</p>
  </div>
);

export default AttorneyCaseStatus;
