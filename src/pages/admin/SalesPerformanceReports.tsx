import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Eye, EyeOff, Send, RefreshCw, FileText, Calendar, Award, TrendingUp, TrendingDown,
  Mail, Shuffle, Pencil, RotateCcw, Save, Search,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { getSampleDrafts, getDraftDefaults, type DraftOverrides, type DraftVariant, type SalesPerfCopyOverrides } from '@/lib/salesPerformanceEmailTemplate';
import {
  AdminPage,
  AdminHeader,
  AdminCard,
  AdminCardHeader,
  AdminCardBody,
  AdminPill,
  AdminEmptyState,
  AdminLoadingState,
  AdminSectionLabel,
  BRAND_TEAL,
} from '@/components/admin/ui/AdminUI';

type Report = {
  id: string;
  consultant_id: string | null;
  consultant_name: string;
  email: string | null;
  period_type: 'weekly' | 'monthly';
  period_start: string;
  period_end: string;
  deals_closed: number;
  target: number;
  target_met: boolean;
  strike_risk_level: 'none' | 'low' | 'medium' | 'high';
  current_strikes: number;
  auto_comment: string | null;
  congratulations: string | null;
  report_html: string | null;
  delivery_status: string;
  sent_at: string | null;
  created_at: string;
};

type PillTone = 'neutral' | 'teal' | 'success' | 'warning' | 'destructive';

// Same tone vocabulary AdminPill uses everywhere else in the app — keeps this
// page's status colors consistent with every other admin screen instead of
// introducing a one-off red/amber/orange scale.
const RISK_TONE: Record<string, PillTone> = {
  none: 'success',
  low: 'warning',
  medium: 'warning',
  high: 'destructive',
};

/** Flat, rounded-none active/inactive treatment used for every tab pair in the Admin Portal. */
const flatTabTrigger =
  'rounded-none px-3 py-1.5 text-xs font-medium data-[state=active]:bg-black data-[state=active]:text-white data-[state=active]:shadow-none';

const SalesPerformanceReports: React.FC = () => {
  const qc = useQueryClient();
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [consultantFilter, setConsultantFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [previewReport, setPreviewReport] = useState<Report | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [draftPeriod, setDraftPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [draftsVisible, setDraftsVisible] = useState(false);
  const [draftNonce, setDraftNonce] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorVariant, setEditorVariant] = useState<DraftVariant>('underPerformer');

  const STORAGE_KEY = 'salesPerfDraftOverrides';
  const [allOverrides, setAllOverrides] = useState<Record<'weekly' | 'monthly', DraftOverrides>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { weekly: {}, monthly: {} };
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(allOverrides)); } catch {}
  }, [allOverrides]);

  const drafts = useMemo(
    () => getSampleDrafts(draftPeriod, allOverrides[draftPeriod]),
    [draftPeriod, draftNonce, allOverrides]
  );

  const defaultsForEditor = useMemo(() => getDraftDefaults(draftPeriod), [draftPeriod]);
  const currentEditorValues: SalesPerfCopyOverrides = {
    ...defaultsForEditor[editorVariant],
    ...(allOverrides[draftPeriod]?.[editorVariant] || {}),
  };

  const updateField = (field: keyof SalesPerfCopyOverrides, value: string) => {
    setAllOverrides(prev => ({
      ...prev,
      [draftPeriod]: {
        ...prev[draftPeriod],
        [editorVariant]: {
          ...defaultsForEditor[editorVariant],
          ...(prev[draftPeriod]?.[editorVariant] || {}),
          [field]: value,
        },
      },
    }));
  };

  const resetVariant = () => {
    setAllOverrides(prev => {
      const next = { ...prev, [draftPeriod]: { ...prev[draftPeriod] } };
      delete next[draftPeriod][editorVariant];
      return next;
    });
    toast.success(`${editorVariant === 'performer' ? 'Performer' : 'Under-performer'} draft reset to default`);
  };

  const { data: reports = [], isLoading, refetch } = useQuery({
    queryKey: ['sales-performance-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_performance_reports' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as unknown as Report[];
    },
  });

  const { data: consultants = [] } = useQuery({
    queryKey: ['sales-consultants-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_consultants')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    return reports.filter(r => {
      if (periodFilter !== 'all' && r.period_type !== periodFilter) return false;
      if (consultantFilter !== 'all' && r.consultant_id !== consultantFilter) return false;
      if (search && !r.consultant_name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [reports, periodFilter, consultantFilter, search]);

  const runReport = async (period_type: 'weekly' | 'monthly', consultant_id?: string, preview = false) => {
    const key = `${period_type}-${consultant_id || 'all'}-${preview ? 'preview' : 'send'}`;
    setGenerating(key);
    try {
      const { data, error } = await supabase.functions.invoke('send-sales-performance-report', {
        body: { period_type, consultant_id, preview },
      });
      if (error) throw error;
      if (preview && data?.results?.[0]?.html) {
        setPreviewReport({
          ...(data.results[0]),
          id: 'preview',
          period_type,
          period_start: data.period.start,
          period_end: data.period.end,
          consultant_name: data.results[0].consultant_name,
          report_html: data.results[0].html,
          deals_closed: data.results[0].deals,
          target: data.results[0].target,
          target_met: data.results[0].targetMet,
          strike_risk_level: data.results[0].risk,
          current_strikes: data.results[0].strikes,
          delivery_status: 'preview',
          sent_at: null,
          created_at: new Date().toISOString(),
          email: data.results[0].email,
          consultant_id: data.results[0].consultant_id,
          auto_comment: data.results[0].comment,
          congratulations: data.results[0].congrats,
        } as Report);
      } else {
        toast.success(`Generated ${data?.count ?? 0} ${period_type} report(s)`);
        qc.invalidateQueries({ queryKey: ['sales-performance-reports'] });
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate report');
    } finally {
      setGenerating(null);
    }
  };

  const sendSampleToMe = async (period_type: 'weekly' | 'monthly') => {
    setGenerating(`sample-${period_type}`);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const adminEmail = auth.user?.email;
      if (!adminEmail) throw new Error('No admin email on session');
      const consultant_id = consultantFilter !== 'all'
        ? consultantFilter
        : consultants[0]?.id;
      if (!consultant_id) throw new Error('No active consultant available to build sample from');
      const { data, error } = await supabase.functions.invoke('send-sales-performance-report', {
        body: { period_type, consultant_id, sample_to: adminEmail },
      });
      if (error) throw error;
      const status = data?.results?.[0]?.deliveryStatus;
      if (status === 'sample_sent') toast.success(`Sample ${period_type} report sent to ${adminEmail}`);
      else toast.error(`Sample send failed: ${status || 'unknown'}`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to send sample');
    } finally {
      setGenerating(null);
    }
  };

  const reportCount = filtered.length;

  return (
    <AdminPage className="brand-legal-theme max-w-7xl">
      <AdminHeader
        eyebrow="System"
        title="Sales Performance Reports"
        icon={Award}
        description="Automated weekly and monthly performance reports delivered directly to each consultant's email."
        actions={
          <Button
            variant="outline"
            size="sm"
            className="rounded-none border-black/15 text-black hover:bg-black/5"
            onClick={() => refetch()}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      {/* Email Draft Templates — collapsed by default so the page opens on the
          report history, not a wall of email previews. */}
      <AdminCard>
        <AdminCardHeader
          icon={Mail}
          title="Email Draft Templates"
          description={
            <>
              Preview the exact email layouts sent to consultants. Weekly reports go out every{' '}
              <strong className="text-black">Monday 09:00 SAST</strong>; monthly reports go out on the{' '}
              <strong className="text-black">last day of the month at 18:00 SAST</strong>.
            </>
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Tabs value={draftPeriod} onValueChange={(v) => setDraftPeriod(v as 'weekly' | 'monthly')}>
                <TabsList className="h-auto rounded-none border border-black/10 bg-white p-0.5">
                  <TabsTrigger value="weekly" className={flatTabTrigger}>Weekly draft</TabsTrigger>
                  <TabsTrigger value="monthly" className={flatTabTrigger}>Monthly draft</TabsTrigger>
                </TabsList>
              </Tabs>
              <Button
                variant="outline"
                size="sm"
                className="rounded-none border-black/15 text-black hover:bg-black/5"
                onClick={() => setDraftsVisible((v) => !v)}
              >
                {draftsVisible ? <><EyeOff className="mr-1.5 h-3.5 w-3.5" /> Hide</> : <><Eye className="mr-1.5 h-3.5 w-3.5" /> Show</>}
              </Button>
            </div>
          }
        />
        {draftsVisible && (
          <AdminCardBody className="space-y-3">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-none border-black/15 text-black hover:bg-black/5"
                onClick={() => setDraftNonce((n) => n + 1)}
                title="Re-roll coaching wording"
              >
                <Shuffle className="mr-1.5 h-3.5 w-3.5" /> Shuffle wording
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-none border-black/15 text-black hover:bg-black/5"
                onClick={() => { setEditorVariant('underPerformer'); setEditorOpen(true); }}
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit drafts
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="border border-black/10">
                <div className="flex items-center gap-2 border-b border-black/10 bg-destructive/5 px-4 py-3">
                  <TrendingDown className="h-4 w-4 shrink-0 text-destructive" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-black">Draft 1 — Under-performing consultant</p>
                    <p className="text-xs text-slate-500">Below target · strike warning · coaching tone</p>
                  </div>
                </div>
                <iframe
                  srcDoc={drafts.underPerformer}
                  className="h-[420px] w-full bg-white sm:h-[560px]"
                  title="Under-performer draft preview"
                />
              </div>
              <div className="border border-black/10">
                <div className="flex items-center gap-2 border-b border-black/10 bg-success/5 px-4 py-3">
                  <TrendingUp className="h-4 w-4 shrink-0 text-success" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-black">Draft 2 — Performing consultant</p>
                    <p className="text-xs text-slate-500">Target met · congratulations · momentum tone</p>
                  </div>
                </div>
                <iframe
                  srcDoc={drafts.performer}
                  className="h-[420px] w-full bg-white sm:h-[560px]"
                  title="Performer draft preview"
                />
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Coaching wording is generated dynamically per performance tier and varies across roles, so the
              system never sounds repetitive. Use <strong className="text-black">Shuffle wording</strong> to
              preview alternative variants.
            </p>
          </AdminCardBody>
        )}
      </AdminCard>

      {/* Filters + quick actions — kept together since the consultant filter
          doubles as the target for the generate/send actions below it. */}
      <AdminCard>
        <AdminCardHeader
          icon={Search}
          title="Filters & Quick Actions"
          description="Narrow the report history below, or generate and send reports on demand."
        />
        <AdminCardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Search consultant
              </label>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name…"
                  className="rounded-none pl-8"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Period</label>
              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger className="mt-1 rounded-none"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Consultant</label>
              <Select value={consultantFilter} onValueChange={setConsultantFilter}>
                <SelectTrigger className="mt-1 rounded-none"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All consultants</SelectItem>
                  {consultants.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <AdminSectionLabel>
            Generate now{consultantFilter !== 'all' ? ' · selected consultant' : ' · all consultants'}
          </AdminSectionLabel>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Button
              variant="outline"
              size="sm"
              className="rounded-none border-black/15 text-black hover:bg-black/5"
              disabled={!!generating}
              onClick={() => runReport('weekly', consultantFilter !== 'all' ? consultantFilter : undefined, true)}
            >
              <Eye className="mr-1.5 h-3.5 w-3.5" /> Preview weekly
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-none border-black/15 text-black hover:bg-black/5"
              disabled={!!generating}
              onClick={() => runReport('monthly', consultantFilter !== 'all' ? consultantFilter : undefined, true)}
            >
              <Eye className="mr-1.5 h-3.5 w-3.5" /> Preview monthly
            </Button>
            <Button
              size="sm"
              className="rounded-none text-white hover:opacity-90"
              style={{ backgroundColor: BRAND_TEAL }}
              disabled={!!generating}
              onClick={() => runReport('weekly', consultantFilter !== 'all' ? consultantFilter : undefined, false)}
            >
              <Send className="mr-1.5 h-3.5 w-3.5" /> Send weekly
            </Button>
            <Button
              size="sm"
              className="rounded-none text-white hover:opacity-90"
              style={{ backgroundColor: BRAND_TEAL }}
              disabled={!!generating}
              onClick={() => runReport('monthly', consultantFilter !== 'all' ? consultantFilter : undefined, false)}
            >
              <Send className="mr-1.5 h-3.5 w-3.5" /> Send monthly
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-none border-black/15 text-black hover:bg-black/5"
              disabled={!!generating}
              onClick={() => sendSampleToMe('weekly')}
            >
              <Send className="mr-1.5 h-3.5 w-3.5" /> Sample weekly
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-none border-black/15 text-black hover:bg-black/5"
              disabled={!!generating}
              onClick={() => sendSampleToMe('monthly')}
            >
              <Send className="mr-1.5 h-3.5 w-3.5" /> Sample monthly
            </Button>
          </div>
        </AdminCardBody>
      </AdminCard>

      {/* Report history — a real table on wide screens, and a stacked card list
          below `lg` so nobody has to fight a sideways-scrolling table on a phone
          on top of the page's own vertical scroll. */}
      <AdminCard>
        <AdminCardHeader
          icon={FileText}
          title="Report History"
          description="Every generated report, most recent first."
          actions={<AdminPill tone="neutral">{reportCount} report{reportCount === 1 ? '' : 's'}</AdminPill>}
        />

        {isLoading ? (
          <AdminLoadingState label="Loading reports…" />
        ) : filtered.length === 0 ? (
          <AdminEmptyState
            icon={FileText}
            title="No performance reports yet"
            description="Use the actions above to generate one, or wait for the next scheduled run."
          />
        ) : (
          <>
            {/* Desktop / tablet-landscape table */}
            <div className="hidden lg:block">
              <Table>
                <TableHeader>
                  <TableRow className="border-black/10 hover:bg-transparent">
                    <TableHead>Consultant</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Range</TableHead>
                    <TableHead className="text-right">Deals / Target</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id} className="border-black/10">
                      <TableCell className="font-medium text-black">{r.consultant_name}</TableCell>
                      <TableCell>
                        <AdminPill tone="neutral" className="capitalize">{r.period_type}</AdminPill>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {format(new Date(r.period_start), 'dd MMM')} – {format(new Date(r.period_end), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-black">
                        {r.deals_closed} / {r.target}
                      </TableCell>
                      <TableCell>
                        <AdminPill tone={r.target_met ? 'success' : 'warning'}>
                          {r.target_met ? 'Target met' : 'Below'}
                        </AdminPill>
                      </TableCell>
                      <TableCell>
                        <AdminPill tone={RISK_TONE[r.strike_risk_level] || 'neutral'} className="capitalize">
                          {r.strike_risk_level}
                        </AdminPill>
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.delivery_status === 'sent' && r.sent_at ? (
                          <span className="font-medium text-success">{format(new Date(r.sent_at), 'dd MMM HH:mm')}</span>
                        ) : (
                          <span className="capitalize text-slate-500">{r.delivery_status}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-none hover:bg-black/5"
                          onClick={() => setPreviewReport(r)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile / tablet-portrait card list — same data, no horizontal scroll. */}
            <div className="divide-y divide-black/10 lg:hidden">
              {filtered.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setPreviewReport(r)}
                  className="flex w-full flex-col gap-3 p-4 text-left transition-colors hover:bg-black/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#00BAAD]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-black">{r.consultant_name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {format(new Date(r.period_start), 'dd MMM')} – {format(new Date(r.period_end), 'dd MMM yyyy')}
                      </p>
                    </div>
                    <AdminPill tone="neutral" className="shrink-0 capitalize">{r.period_type}</AdminPill>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Deals / Target</p>
                      <p className="mt-0.5 font-semibold tabular-nums text-black">{r.deals_closed} / {r.target}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Sent</p>
                      <p className="mt-0.5">
                        {r.delivery_status === 'sent' && r.sent_at ? (
                          <span className="font-medium text-success">{format(new Date(r.sent_at), 'dd MMM HH:mm')}</span>
                        ) : (
                          <span className="capitalize text-slate-500">{r.delivery_status}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <AdminPill tone={r.target_met ? 'success' : 'warning'}>
                      {r.target_met ? 'Target met' : 'Below'}
                    </AdminPill>
                    <AdminPill tone={RISK_TONE[r.strike_risk_level] || 'neutral'} className="capitalize">
                      {r.strike_risk_level} risk
                    </AdminPill>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </AdminCard>

      <Dialog open={!!previewReport} onOpenChange={(open) => !open && setPreviewReport(null)}>
        <DialogContent className="brand-legal-theme flex max-h-[90vh] max-w-3xl flex-col rounded-none border-black/10 p-0 shadow-none">
          <DialogHeader className="space-y-0 border-b border-black/10 px-5 py-4">
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-black">
              <Calendar className="h-4 w-4" style={{ color: BRAND_TEAL }} />
              {previewReport?.consultant_name} — <span className="capitalize">{previewReport?.period_type}</span> report
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-5 pt-4">
            {previewReport?.report_html ? (
              <iframe
                srcDoc={previewReport.report_html}
                className="h-[70vh] w-full border border-black/10"
                title="Report preview"
              />
            ) : (
              <p className="text-sm text-slate-500">No rendered HTML available.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="brand-legal-theme flex max-h-[92vh] max-w-6xl flex-col rounded-none border-black/10 p-0 shadow-none">
          <DialogHeader className="space-y-0 border-b border-black/10 px-5 py-4">
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-black">
              <Pencil className="h-4 w-4" style={{ color: BRAND_TEAL }} /> Edit {draftPeriod} email drafts
            </DialogTitle>
          </DialogHeader>
          <Tabs
            value={editorVariant}
            onValueChange={(v) => setEditorVariant(v as DraftVariant)}
            className="flex flex-1 flex-col overflow-hidden px-5 pb-5 pt-4"
          >
            <div className="-mx-1 overflow-x-auto px-1">
              <TabsList className="h-auto self-start rounded-none border border-black/10 bg-white p-0.5">
                <TabsTrigger value="underPerformer" className={flatTabTrigger}>
                  <TrendingDown className="mr-1 h-3.5 w-3.5" />Under-performing
                </TabsTrigger>
                <TabsTrigger value="performer" className={flatTabTrigger}>
                  <TrendingUp className="mr-1 h-3.5 w-3.5" />Performing
                </TabsTrigger>
              </TabsList>
            </div>
            <div className="mt-3 grid flex-1 grid-cols-1 gap-4 overflow-auto lg:grid-cols-2 lg:overflow-hidden">
              <div className="space-y-3 overflow-auto pr-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-slate-500">
                    Edits save instantly to this browser and update the preview on the right. Use placeholders{' '}
                    <code>{'{dateRange}'}</code>, <code>{'{firstName}'}</code>, <code>{'{periodType}'}</code> in the
                    greeting line.
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 rounded-none hover:bg-black/5"
                    onClick={resetVariant}
                  >
                    <RotateCcw className="mr-1 h-4 w-4" /> Reset
                  </Button>
                </div>
                {([
                  { key: 'headerTitle', label: 'Header title', rows: 1 },
                  { key: 'headerTagline', label: 'Header tagline', rows: 1 },
                  { key: 'greetingIntro', label: 'Greeting / intro line', rows: 2 },
                  { key: 'congrats', label: 'Congratulations banner (leave blank to hide)', rows: 2 },
                  { key: 'comment', label: "Manager's note (coaching expectations)", rows: 5 },
                  { key: 'managerNoteHeading', label: "Manager's note heading", rows: 1 },
                  { key: 'footerNote', label: 'Footer note', rows: 2 },
                ] as Array<{ key: keyof SalesPerfCopyOverrides; label: string; rows: number }>).map((f) => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-xs font-medium text-black">{f.label}</Label>
                    <Textarea
                      rows={f.rows}
                      value={currentEditorValues[f.key] ?? ''}
                      onChange={(e) => updateField(f.key, e.target.value)}
                      className="rounded-none text-sm"
                    />
                  </div>
                ))}
                <p className="flex items-center gap-1 pt-2 text-xs text-slate-500">
                  <Save className="h-3 w-3" /> Saved automatically to this browser.
                </p>
              </div>
              <div className="overflow-hidden border border-black/10">
                <div className="flex items-center gap-2 border-b border-black/10 bg-black/[0.03] px-3 py-2 text-xs font-semibold text-black">
                  <Eye className="h-3.5 w-3.5" style={{ color: BRAND_TEAL }} /> Live preview —{' '}
                  {editorVariant === 'performer' ? 'Performing consultant' : 'Under-performing consultant'} ({draftPeriod})
                </div>
                <iframe
                  srcDoc={editorVariant === 'performer' ? drafts.performer : drafts.underPerformer}
                  className="h-[420px] w-full bg-white lg:h-[68vh]"
                  title="Live email preview"
                />
              </div>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
};

export default SalesPerformanceReports;
