import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { FileText, RefreshCw, Mail, Printer, Wrench, Search } from 'lucide-react';
import { format } from 'date-fns';
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
} from '@/components/admin/ui/AdminUI';

type PeriodType = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

const PERIOD_TYPES: { value: PeriodType; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

type WeeklyOpsReport = {
  id: string;
  period_type: PeriodType;
  period_start: string;
  period_end: string;
  payments_count: number;
  payments_total: number;
  assessments_booked_count: number;
  submitted_reports_count: number | null;
  province_deals_closed: Record<string, number> | null;
  top_expert_name: string | null;
  top_expert_province: string | null;
  top_expert_bookings_count: number | null;
  is_combined: boolean | null;
  generated_for_role: string | null;
  report_html: string | null;
  recipients: string[];
  delivery_status: string;
  delivery_error: string | null;
  sent_at: string | null;
  created_at: string;
};

type CaseStatusRow = {
  id: string;
  appointment_date: string;
  case_status: string | null;
  claimant_id: string;
  referring_attorney: string | null;
  manually_reclassified_at: string | null;
};

const ZAR = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(Number(n) || 0);

const STATUS_TONE: Record<string, 'neutral' | 'teal' | 'success' | 'warning' | 'destructive'> = {
  sent: 'success',
  failed: 'destructive',
  skipped: 'warning',
  pending: 'neutral',
};

const CASE_STATUS_OPTIONS = [
  'pending', 'scheduled', 'confirmed', 'in_progress', 'completed', 'assessed', 'cancelled', 'taken_out', 'declined by expert',
];

const provinceSummary = (deals: Record<string, number> | null | undefined) => {
  if (!deals || !Object.keys(deals).length) return '—';
  return Object.entries(deals)
    .sort((a, b) => b[1] - a[1])
    .map(([p, c]) => `${p}: ${c}`)
    .join(', ');
};

const WeeklyOperationsReport: React.FC = () => {
  const qc = useQueryClient();
  const { isAdmin, userRole } = usePermissions();
  const [generating, setGenerating] = useState(false);
  const [periodType, setPeriodType] = useState<PeriodType>('weekly');
  // "all" avoids the classic "totals look lower than expected" trap of an
  // accidentally narrow year filter hiding most of the data set.
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [reclassifyOpen, setReclassifyOpen] = useState(false);

  const REPORT_LIST_COLUMNS =
    'id, period_type, period_start, period_end, payments_count, payments_total, assessments_booked_count, submitted_reports_count, province_deals_closed, top_expert_name, top_expert_province, top_expert_bookings_count, is_combined, generated_for_role, recipients, delivery_status, delivery_error, sent_at, created_at';

  const { data: reports, isLoading, isFetching } = useQuery({
    // periodType/yearFilter are part of the key: each combination is filtered
    // server-side below, so switching either one fetches its own correct page
    // of data instead of re-filtering a single shared top-100 snapshot that
    // could be dominated by whichever period type is generated most often.
    queryKey: ['weekly-operations-reports', periodType, yearFilter],
    queryFn: async () => {
      let query = supabase
        .from('weekly_operations_reports')
        // report_html deliberately excluded: it's the full rendered email body
        // (can be tens of KB per row) and this list never displays it. Fetched
        // on demand instead, only for the row the user actually prints.
        .select(REPORT_LIST_COLUMNS)
        .eq('period_type', periodType)
        .order('period_start', { ascending: false })
        .limit(200);

      if (yearFilter !== 'all') {
        query = query.gte('period_start', `${yearFilter}-01-01`).lte('period_start', `${yearFilter}-12-31`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as WeeklyOpsReport[];
    },
  });

  // Independent of yearFilter (only scoped to the selected report type) so the
  // Year dropdown always lists every year that has data, even the ones not
  // currently selected.
  const { data: yearRows } = useQuery({
    queryKey: ['weekly-operations-report-years', periodType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weekly_operations_reports')
        .select('period_start')
        .eq('period_type', periodType)
        .order('period_start', { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data || []) as { period_start: string }[];
    },
  });

  const fetchReportHtml = async (id: string): Promise<string | null> => {
    const { data, error } = await supabase
      .from('weekly_operations_reports')
      .select('report_html')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      toast.error(error.message || 'Failed to load report content');
      return null;
    }
    return (data as any)?.report_html ?? null;
  };

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    (yearRows || []).forEach((r) => years.add(String(new Date(r.period_start).getFullYear())));
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [yearRows]);

  const filteredReports = reports;

  const generateReport = async () => {
    setGenerating(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke('send-weekly-operations-report', {
        body: { period_type: periodType, generated_by: auth.user?.id || null },
      });
      if (error) throw error;
      if (data?.delivery_status === 'skipped') {
        toast.warning(`Report generated but not emailed: ${data?.delivery_error || 'no recipients configured'}`);
      } else if (data?.delivery_status === 'sent') {
        toast.success(`${periodType[0].toUpperCase()}${periodType.slice(1)} report generated and sent`);
      } else {
        toast.error(`Report generation failed: ${data?.delivery_error || 'unknown error'}`);
      }
      qc.invalidateQueries({ queryKey: ['weekly-operations-reports'] });
      qc.invalidateQueries({ queryKey: ['weekly-operations-report-years'] });
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  // Shared by print and download: resolves once every image in the given
  // root (the branding logo, etc.) has finished loading or failed, with a
  // safety timeout so we never hang forever on a slow/blocked image.
  const waitForImages = (root: Document | HTMLElement): Promise<void> => {
    const images = Array.from(root.querySelectorAll ? root.querySelectorAll('img') : (root as Document).images);
    if (images.length === 0) return Promise.resolve();
    return new Promise((resolve) => {
      let settled = false;
      let remaining = images.length;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const maybeDone = () => {
        remaining -= 1;
        if (remaining <= 0) done();
      };
      images.forEach((img: HTMLImageElement) => {
        if (img.complete) {
          maybeDone();
        } else {
          img.addEventListener('load', maybeDone, { once: true });
          img.addEventListener('error', maybeDone, { once: true });
        }
      });
      setTimeout(done, 2500);
    });
  };

  const printReport = async (r: WeeklyOpsReport) => {
    // Combined (company-wide) reports may only be printed by admins.
    if (r.is_combined !== false && !isAdmin()) {
      toast.error('Only admins can print or download the combined report.');
      return;
    }
    const html = await fetchReportHtml(r.id);
    if (!html) {
      toast.error('No stored report content available to print for this entry.');
      return;
    }
    const win = window.open('', '_blank');
    if (!win) {
      toast.error("Pop-up blocked — allow pop-ups for this site to print, then try again.");
      return;
    }
    win.document.write(html);
    win.document.close();

    // Wait for images before printing — calling print() right after
    // document.write() can fire before an external image has actually
    // loaded, which is why the logo sometimes showed up and sometimes
    // didn't. It's a timing race, not a styling bug.
    await waitForImages(win.document);
    win.focus();
    win.print();
  };

  return (
    <AdminPage className="brand-legal-theme max-w-6xl">
      <AdminHeader
        eyebrow="System"
        title="Weekly / Monthly Operations Report"
        icon={Mail}
        description="Generate weekly, monthly, quarterly and yearly operations summaries — expert payments, assessments booked, reports submitted, and deals closed by province — with a full history retained per report."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="rounded-none"
              disabled={isFetching}
              onClick={() => {
                qc.invalidateQueries({ queryKey: ['weekly-operations-reports'] });
                qc.invalidateQueries({ queryKey: ['weekly-operations-report-years'] });
              }}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              {isFetching ? 'Refreshing…' : 'Refresh'}
            </Button>
            {isAdmin() && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-none"
                onClick={() => setReclassifyOpen(true)}
              >
                <Wrench className="mr-2 h-4 w-4" />
                Reclassify Appointment
              </Button>
            )}
            <Button
              size="sm"
              className="rounded-none gradient-teal text-white"
              onClick={generateReport}
              disabled={generating}
            >
              <FileText className="mr-2 h-4 w-4" />
              {generating ? 'Generating…' : `Generate ${periodType[0].toUpperCase()}${periodType.slice(1)} Report`}
            </Button>
          </>
        }
      />

      <p className="text-xs text-slate-500">
        Reports now also generate automatically — weekly every Monday, monthly on the last day of the month,
        quarterly on the last day of the quarter, and yearly on 31 December — and are emailed to the configured
        recipients. "Generate Report" below runs an authorized report on demand for the currently selected period.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[160px]">
          <AdminSectionLabel>Report Type</AdminSectionLabel>
          <Select value={periodType} onValueChange={(v) => setPeriodType(v as PeriodType)}>
            <SelectTrigger className="rounded-none border-black/15">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_TYPES.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[140px]">
          <AdminSectionLabel>Year</AdminSectionLabel>
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="rounded-none border-black/15">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {availableYears.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {yearFilter !== 'all' && (
          <p className="pb-2 text-xs text-amber-700">
            Showing {yearFilter} only. If totals look lower than expected, switch back to "All Years" to see the complete data set.
          </p>
        )}
      </div>

      <AdminCard>
        <AdminCardHeader
          title="Report History"
          description="Every generated report is logged here for audit trail purposes. Only admins can print or download the combined (company-wide) report — per-user reports are generated and delivered according to each staff member's function."
          icon={FileText}
        />
        <AdminCardBody className="p-0">
          {isLoading ? (
            <AdminLoadingState label="Loading report history…" />
          ) : !filteredReports?.length ? (
            <AdminEmptyState
              icon={Mail}
              title="No reports for this filter"
              description="Generate a report above, or switch the Report Type / Year filter to see existing history."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-black/10 hover:bg-transparent">
                    <TableHead>Period</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Payments</TableHead>
                    <TableHead>Total Paid</TableHead>
                    <TableHead>Assessments</TableHead>
                    <TableHead>Reports Submitted</TableHead>
                    <TableHead>Deals Closed by Province</TableHead>
                    <TableHead>Most Booked Expert</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReports.map((r) => {
                    const canPrint = r.is_combined === false ? true : isAdmin();
                    return (
                      <TableRow key={r.id} className="border-black/10">
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(r.period_start), 'dd MMM yyyy')} – {format(new Date(r.period_end), 'dd MMM yyyy')}
                        </TableCell>
                        <TableCell>
                          <AdminPill tone={r.is_combined === false ? 'teal' : 'neutral'}>
                            {r.is_combined === false ? (r.generated_for_role || 'Staff') : 'Combined'}
                          </AdminPill>
                        </TableCell>
                        <TableCell>{r.payments_count}</TableCell>
                        <TableCell>{ZAR(r.payments_total)}</TableCell>
                        <TableCell>{r.assessments_booked_count}</TableCell>
                        <TableCell>{r.submitted_reports_count ?? 0}</TableCell>
                        <TableCell className="max-w-[220px] truncate" title={provinceSummary(r.province_deals_closed)}>
                          {provinceSummary(r.province_deals_closed)}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {r.top_expert_name ? `${r.top_expert_name} (${r.top_expert_province || '—'})` : '—'}
                        </TableCell>
                        <TableCell>
                          <AdminPill tone={STATUS_TONE[r.delivery_status] || 'neutral'}>
                            {r.delivery_status}
                          </AdminPill>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {r.sent_at ? format(new Date(r.sent_at), 'dd MMM yyyy HH:mm') : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {canPrint ? (
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none" onClick={() => printReport(r)} title="Print">
                                <Printer className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">Admin only</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </AdminCardBody>
      </AdminCard>

      {isAdmin() && (
        <ReclassifyAppointmentDialog open={reclassifyOpen} onOpenChange={setReclassifyOpen} />
      )}
    </AdminPage>
  );
};

// ---------------------------------------------------------------------------
// Manual appointment reclassification
//
// Appointments created before this update are NOT automatically reclassified
// — staff are still partly working from Lovable and have not all moved to
// the app yet, so any historical records that were filed under the wrong
// case status need to be corrected here by hand, with a visible audit trail.
// ---------------------------------------------------------------------------
const ReclassifyAppointmentDialog: React.FC<{ open: boolean; onOpenChange: (v: boolean) => void }> = ({ open, onOpenChange }) => {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<CaseStatusRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<CaseStatusRow | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const runSearch = async () => {
    if (!search.trim()) return;
    setSearching(true);
    try {
      // Search by claimant name, referring attorney name, and (if it's shaped
      // like a UUID) exact appointment ID — results from all three are merged.
      const { data: claimants } = await supabase
        .from('claimants')
        .select('id, first_name, last_name')
        .or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`)
        .limit(10);
      const claimantIds = (claimants || []).map((c: any) => c.id);
      const term = search.trim();
      const looksLikeId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(term);

      const baseSelect = 'id, appointment_date, case_status, claimant_id, referring_attorney, manually_reclassified_at';

      // Run every relevant match in parallel and merge — claimant name,
      // referring attorney name, and (only when it's shaped like one) exact
      // appointment ID — instead of only trying claimant name and silently
      // failing back to an ID match that breaks on non-UUID input.
      const queries = [
        claimantIds.length
          ? supabase.from('appointments').select(baseSelect).is('deleted_at', null).in('claimant_id', claimantIds).order('appointment_date', { ascending: false }).limit(20)
          : null,
        supabase.from('appointments').select(baseSelect).is('deleted_at', null).ilike('referring_attorney', `%${term}%`).order('appointment_date', { ascending: false }).limit(20),
        looksLikeId
          ? supabase.from('appointments').select(baseSelect).is('deleted_at', null).eq('id', term).limit(1)
          : null,
      ].filter(Boolean) as any[];

      const responses = await Promise.all(queries);
      const errorResp = responses.find((r: any) => r.error);
      if (errorResp?.error) throw errorResp.error;

      const merged = new Map<string, CaseStatusRow>();
      responses.forEach((r: any) => (r.data || []).forEach((row: CaseStatusRow) => merged.set(row.id, row)));
      const data = Array.from(merged.values()).sort(
        (a, b) => new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime(),
      );

      setResults(data);
      if (!data.length) toast.info('No matching appointments found.');
    } catch (e: any) {
      toast.error(e.message || 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const saveReclassification = async () => {
    if (!selected || !newStatus) return;
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id || null;

      const { error: updateErr } = await supabase
        .from('appointments')
        .update({
          case_status: newStatus,
          manually_reclassified_at: new Date().toISOString(),
          manually_reclassified_by: userId,
          reclassification_note: note || null,
        })
        .eq('id', selected.id);
      if (updateErr) throw updateErr;

      const { error: logErr } = await supabase.from('appointment_reclassification_log').insert({
        appointment_id: selected.id,
        previous_case_status: selected.case_status,
        new_case_status: newStatus,
        note: note || null,
        changed_by: userId,
      });
      if (logErr) throw logErr;

      toast.success('Appointment reclassified and logged.');
      setSelected(null);
      setNewStatus('');
      setNote('');
      setResults((prev) => prev.map((r) => (r.id === selected.id ? { ...r, case_status: newStatus, manually_reclassified_at: new Date().toISOString() } : r)));
    } catch (e: any) {
      toast.error(e.message || 'Failed to save reclassification');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-none">
        <DialogHeader>
          <DialogTitle>Reclassify Historical Appointment</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-slate-500">
          Appointments created before this update are not reclassified automatically. Search for the record below,
          then correct its case status by hand. Every change is logged with who made it and when.
        </p>

        <div className="flex gap-2">
          <Input
            placeholder="Search by claimant name, referring attorney, or appointment ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            className="rounded-none border-black/15"
          />
          <Button onClick={runSearch} disabled={searching} className="rounded-none gradient-teal text-white">
            <Search className="mr-2 h-4 w-4" />
            {searching ? 'Searching…' : 'Search'}
          </Button>
        </div>

        {results.length > 0 && (
          <div className="max-h-56 overflow-y-auto border border-black/10">
            <Table>
              <TableHeader>
                <TableRow className="border-black/10 hover:bg-transparent">
                  <TableHead>Date</TableHead>
                  <TableHead>Referring Attorney</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((r) => (
                  <TableRow key={r.id} className="border-black/10">
                    <TableCell>{format(new Date(r.appointment_date), 'dd MMM yyyy')}</TableCell>
                    <TableCell className="max-w-[160px] truncate">{r.referring_attorney || '—'}</TableCell>
                    <TableCell className="capitalize">
                      {r.case_status || 'unknown'}
                      {r.manually_reclassified_at && <span className="ml-1 text-[10px] text-amber-600">(manually corrected)</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" className="rounded-none" onClick={() => { setSelected(r); setNewStatus(r.case_status || ''); }}>
                        Reclassify
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {selected && (
          <div className="space-y-3 border-t border-black/10 pt-3">
            <div>
              <Label className="text-xs">New Case Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="rounded-none border-black/15">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {CASE_STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Reason for correction</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Filed incorrectly while staff were still working in Lovable — correcting to match actual outcome."
                className="rounded-none border-black/15"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" className="rounded-none" onClick={() => onOpenChange(false)}>Close</Button>
          {selected && (
            <Button
              className="rounded-none gradient-teal text-white"
              onClick={saveReclassification}
              disabled={saving || !newStatus}
            >
              {saving ? 'Saving…' : 'Save Reclassification'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WeeklyOperationsReport;
