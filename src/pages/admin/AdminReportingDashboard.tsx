import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Users, FileCheck, Clock, AlertTriangle, Download, Mail, ChevronDown,
  FileText, Calendar, DollarSign, TrendingUp, Briefcase, FileSpreadsheet,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addBrandingToPDF, addBrandingFooter, getStyledTableOptions } from '@/utils/pdfBranding';
import { formatExpertType } from '@/utils/expertTypeMapping';

type Period = 'monthly' | 'quarterly' | 'yearly';

interface Row {
  appointment_id: string;
  appointment_date: string;
  case_status: string | null;
  claimant_id: string;
  claimant_name: string;
  claimant_auto_id: string;
  referring_attorney: string | null;
  report_status: string | null;
  report_submitted_date: string | null;
  expert_type: string | null;
}

const SUBMITTED_STATUSES = new Set([
  'completed', 'uploaded', 'report submitted', 'report_submitted',
  'report_fully_paid_&_submitted', 'report_submitted_on_aod',
  'report_submitted_without_full_payment',
]);
const IN_PROGRESS_STATUSES = new Set([
  'initial_stage', 'preparing_report', 'report_on_final_stage',
  'joint_minutes', 'addendum', 'court_preparation', 're-assessment',
]);

const isSubmitted = (s?: string | null) => !!s && SUBMITTED_STATUSES.has(s.toLowerCase());
const isInProgress = (s?: string | null) => !!s && IN_PROGRESS_STATUSES.has(s.toLowerCase());

const getPeriodRange = (period: Period, year: number, month?: number, quarter?: number) => {
  let start: Date, end: Date;
  if (period === 'monthly' && month != null) {
    start = new Date(year, month - 1, 1);
    end = new Date(year, month, 1);
  } else if (period === 'quarterly' && quarter != null) {
    start = new Date(year, (quarter - 1) * 3, 1);
    end = new Date(year, quarter * 3, 1);
  } else {
    start = new Date(year, 0, 1);
    end = new Date(year + 1, 0, 1);
  }
  return { start, end };
};

const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const REPORT_TYPES = [
  { id: 'assessment_summary', name: 'Assessment Summary Report', icon: FileText, desc: 'Per-claimant grouped assessment overview with statuses' },
  { id: 'progress', name: 'Report Progress Update', icon: Clock, desc: 'In-progress reports and ETA per claimant' },
  { id: 'outstanding', name: 'Outstanding Reports Notice', icon: AlertTriangle, desc: 'Reports overdue or not yet submitted' },
  { id: 'submitted', name: 'Submitted Reports Confirmation', icon: FileCheck, desc: 'Confirmation list of all delivered reports' },
  { id: 'financial', name: 'Financial Statement', icon: DollarSign, desc: 'Fees, deposits, AODs and outstanding payments' },
  { id: 'case_status', name: 'Case Status Brief', icon: Briefcase, desc: 'Litigation phase per matter' },
  { id: 'appointment_schedule', name: 'Upcoming Appointment Schedule', icon: Calendar, desc: 'Next appointments per claimant' },
  { id: 'expert_panel', name: 'Expert Panel Allocation', icon: Users, desc: 'Experts allocated per claimant/matter' },
  { id: 'kpi_dashboard', name: 'KPI / Performance Snapshot', icon: TrendingUp, desc: 'Turnaround, completion rate and volumes' },
  { id: 'monthly_invoice', name: 'Monthly Invoice Statement', icon: FileSpreadsheet, desc: 'Itemised billing for the period' },
];

const AdminReportingDashboard: React.FC = () => {
  const { toast } = useToast();
  const now = new Date();
  const [period, setPeriod] = useState<Period>('monthly');
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [quarter, setQuarter] = useState<number>(Math.floor(now.getMonth() / 3) + 1);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [openClaimants, setOpenClaimants] = useState<Record<string, boolean>>({});
  const [attorneyFilter, setAttorneyFilter] = useState<string>('all');
  const [claimantComments, setClaimantComments] = useState<Record<string, string>>({});
  const [activeAttorneys, setActiveAttorneys] = useState<{ name: string; matters: number }[]>([]);

  // Fetch all active referring attorneys with matters from 2025-01-01 to date
  useEffect(() => {
    const fetchActiveAttorneys = async () => {
      try {
        const since = new Date('2025-01-01').toISOString();
        const counts = new Map<string, number>();
        const pageSize = 1000;
        let from = 0;
        // Paginate to bypass 1000-row default limit
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { data, error } = await supabase
            .from('appointments')
            .select('referring_attorney')
            .is('deleted_at', null)
            .gte('appointment_date', since)
            .not('referring_attorney', 'is', null)
            .range(from, from + pageSize - 1);
          if (error) throw error;
          (data || []).forEach((r: any) => {
            const name = (r.referring_attorney || '').trim();
            if (!name || /kutlwano associate/i.test(name)) return;
            counts.set(name, (counts.get(name) || 0) + 1);
          });
          if (!data || data.length < pageSize) break;
          from += pageSize;
        }
        const list = Array.from(counts.entries())
          .map(([name, matters]) => ({ name, matters }))
          .sort((a, b) => b.matters - a.matters || a.name.localeCompare(b.name));
        setActiveAttorneys(list);
      } catch (e) {
        console.error('Failed to load active attorneys', e);
      }
    };
    fetchActiveAttorneys();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { start, end } = getPeriodRange(period, year, month, quarter);
      const { data: appts, error } = await supabase
        .from('appointments')
        .select('id, appointment_date, case_status, referring_attorney, expert:medical_experts(expert_type, first_name, last_name), claimant:claimants(id, first_name, last_name, auto_id), expert_reports(report_status, report_submitted_date)')
        .is('deleted_at', null)
        .gte('appointment_date', start.toISOString())
        .lt('appointment_date', end.toISOString())
        .order('appointment_date', { ascending: false });
      if (error) throw error;

      const mapped: Row[] = (appts || []).map((a: any) => {
        const er = Array.isArray(a.expert_reports) ? a.expert_reports[0] : a.expert_reports;
        const c = a.claimant;
        const ex = Array.isArray(a.expert) ? a.expert[0] : a.expert;
        return {
          appointment_id: a.id,
          appointment_date: a.appointment_date,
          case_status: a.case_status,
          claimant_id: c?.id ?? a.id,
          claimant_name: c ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() : 'Unknown',
          claimant_auto_id: c?.auto_id ?? '—',
          referring_attorney: a.referring_attorney,
          report_status: er?.report_status ?? null,
          report_submitted_date: er?.report_submitted_date ?? null,
          expert_type: ex?.expert_type ?? null,
        };
      });
      setRows(mapped);
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Failed to load', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [period, year, month, quarter]);

  // Attorney options derived from rows
  const attorneyOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => { if (r.referring_attorney) set.add(r.referring_attorney); });
    return Array.from(set).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (attorneyFilter === 'all') return rows;
    return rows.filter((r) => (r.referring_attorney ?? '') === attorneyFilter);
  }, [rows, attorneyFilter]);

  // Group by claimant
  const grouped = useMemo(() => {
    const m = new Map<string, { name: string; auto_id: string; attorney: string | null; items: Row[] }>();
    filteredRows.forEach((r) => {
      const key = r.claimant_id;
      if (!m.has(key)) m.set(key, { name: r.claimant_name, auto_id: r.claimant_auto_id, attorney: r.referring_attorney, items: [] });
      m.get(key)!.items.push(r);
    });
    return Array.from(m.entries()).map(([id, v]) => ({ id, ...v }));
  }, [filteredRows]);

  const metrics = useMemo(() => {
    const totalClaimants = grouped.length;
    let submitted = 0, inProgress = 0, outstanding = 0;
    filteredRows.forEach((r) => {
      if (isSubmitted(r.report_status)) submitted++;
      else if (isInProgress(r.report_status)) inProgress++;
      else outstanding++;
    });
    return { totalClaimants, totalAssessments: filteredRows.length, submitted, inProgress, outstanding };
  }, [filteredRows, grouped]);

  const periodLabel = useMemo(() => {
    if (period === 'monthly') return `${monthNames[month - 1]} ${year}`;
    if (period === 'quarterly') return `Q${quarter} ${year}`;
    return `${year}`;
  }, [period, year, month, quarter]);

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const attorneyHeader = attorneyFilter !== 'all' ? attorneyFilter : 'All Referring Attorneys';
    const startY = addBrandingToPDF(doc, 'Reporting System', `${attorneyHeader} · ${period.charAt(0).toUpperCase() + period.slice(1)} · ${periodLabel}`);

    // KPI summary
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    const kpiText = `Claimants: ${metrics.totalClaimants}   |   Assessments: ${metrics.totalAssessments}   |   Submitted: ${metrics.submitted}   |   In Progress: ${metrics.inProgress}   |   Outstanding: ${metrics.outstanding}`;
    doc.text(kpiText, 14, startY);

    const head = [['Claimant ID', 'Claimant / Experts Seen', 'Referring Attorney', 'Appointment Date', 'Case Status', 'Report Status', 'Submitted On']];
    const body: string[][] = [];
    grouped.forEach((g) => {
      const expertTypes = Array.from(new Set(
        g.items.map((r) => r.expert_type ? formatExpertType(r.expert_type) : null).filter(Boolean) as string[]
      ));
      const nameCell = expertTypes.length
        ? `${g.name}\nExperts: ${expertTypes.join(', ')}`
        : g.name;
      g.items.forEach((r, idx) => {
        body.push([
          idx === 0 ? g.auto_id : '',
          idx === 0 ? nameCell : '',
          idx === 0 ? (g.attorney ?? '') : '',
          new Date(r.appointment_date).toLocaleDateString('en-ZA'),
          r.case_status ?? '—',
          r.report_status ?? 'pending',
          r.report_submitted_date ? new Date(r.report_submitted_date).toLocaleDateString('en-ZA') : '—',
        ]);
      });
    });

    const tableOptions = getStyledTableOptions();
    autoTable(doc, {
      startY: startY + 6,
      head,
      body,
      ...tableOptions,
      styles: { ...tableOptions.styles, fontSize: 8, cellPadding: 2, valign: 'top' },
      headStyles: { ...tableOptions.headStyles, fontSize: 8 },
      margin: { left: 10, right: 10 },
    });

    if (comment.trim()) {
      const finalY = (doc as any).lastAutoTable?.finalY ?? startY + 20;
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text('Summary / Comments', 14, finalY + 10);
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      const lines = doc.splitTextToSize(comment, 270);
      doc.text(lines, 14, finalY + 16);
    }

    addBrandingFooter(doc);
    doc.save(`reporting-${period}-${periodLabel.replace(/\s+/g, '_')}.pdf`);
    toast({ title: 'Export ready', description: `${period} PDF report exported.` });
  };

  const exportAttorneyPDF = () => {
    if (attorneyFilter === 'all') {
      toast({ title: 'Select an attorney', description: 'Choose a referring attorney to generate this report.', variant: 'destructive' });
      return;
    }
    const doc = new jsPDF({ orientation: 'landscape' });
    const startY = addBrandingToPDF(doc, 'Referring Attorney Report', `${attorneyFilter} · ${period.charAt(0).toUpperCase() + period.slice(1)} · ${periodLabel}`);

    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(
      `Claimants: ${metrics.totalClaimants}   |   Assessments: ${metrics.totalAssessments}   |   Submitted: ${metrics.submitted}   |   In Progress: ${metrics.inProgress}   |   Outstanding: ${metrics.outstanding}`,
      14, startY,
    );

    const head = [['Claimant Full Name', 'Total Assessments', 'Submitted', 'In Progress', 'Outstanding', 'Comment']];
    const body = grouped.map((g) => {
      const sub = g.items.filter((r) => isSubmitted(r.report_status)).length;
      const ip = g.items.filter((r) => isInProgress(r.report_status)).length;
      const out = g.items.length - sub - ip;
      return [
        `${g.name} (${g.auto_id})`,
        String(g.items.length),
        String(sub),
        String(ip),
        String(out),
        claimantComments[g.id] ?? '',
      ];
    });

    const tableOptions = getStyledTableOptions();
    autoTable(doc, {
      startY: startY + 6,
      head,
      body,
      ...tableOptions,
      styles: { ...tableOptions.styles, fontSize: 9, cellPadding: 3, valign: 'top' },
      headStyles: { ...tableOptions.headStyles, fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 25, halign: 'center' },
        2: { cellWidth: 25, halign: 'center' },
        3: { cellWidth: 25, halign: 'center' },
        4: { cellWidth: 25, halign: 'center' },
        5: { cellWidth: 'auto' },
      },
      margin: { left: 10, right: 10 },
    });

    if (comment.trim()) {
      const finalY = (doc as any).lastAutoTable?.finalY ?? startY + 20;
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text('Overall Summary / Comments', 14, finalY + 10);
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      const lines = doc.splitTextToSize(comment, 270);
      doc.text(lines, 14, finalY + 16);
    }

    addBrandingFooter(doc);
    const safeName = attorneyFilter.replace(/[^a-z0-9]+/gi, '_');
    doc.save(`attorney-${safeName}-${period}-${periodLabel.replace(/\s+/g, '_')}.pdf`);
    toast({ title: 'Attorney report ready', description: `${attorneyFilter} · ${periodLabel}` });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reporting System</h1>
          <p className="text-sm text-muted-foreground">Claimant-centric reporting for {periodLabel}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={period} onValueChange={(v: Period) => setPeriod(v)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
          {period === 'monthly' && (
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {monthNames.map((n, i) => <SelectItem key={i} value={String(i + 1)}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {period === 'quarterly' && (
            <Select value={String(quarter)} onValueChange={(v) => setQuarter(Number(v))}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4].map((q) => <SelectItem key={q} value={String(q)}>Q{q}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={attorneyFilter} onValueChange={setAttorneyFilter}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Referring Attorney" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Referring Attorneys</SelectItem>
              {attorneyOptions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportPDF} className="gap-2">
            <Download className="h-4 w-4" /> Export PDF
          </Button>
          <Button size="sm" onClick={exportAttorneyPDF} className="gap-2" disabled={attorneyFilter === 'all'}>
            <Download className="h-4 w-4" /> Attorney Report
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total Claimants Assessed', value: metrics.totalClaimants, icon: Users, color: 'text-primary' },
          { label: 'Total Assessments', value: metrics.totalAssessments, icon: Briefcase, color: 'text-foreground' },
          { label: 'Reports Submitted', value: metrics.submitted, icon: FileCheck, color: 'text-emerald-600' },
          { label: 'In Progress', value: metrics.inProgress, icon: Clock, color: 'text-amber-600' },
          { label: 'Outstanding', value: metrics.outstanding, icon: AlertTriangle, color: 'text-rose-600' },
        ].map((k) => (
          <Card key={k.label} className="border-border/50">
            <CardContent className="pt-4 pb-3 px-4">
              <k.icon className={`h-4 w-4 mb-2 ${k.color}`} />
              <p className="text-2xl font-bold text-foreground">{k.value}</p>
              <p className="text-[11px] text-muted-foreground">{k.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="claimants">
        <TabsList>
          <TabsTrigger value="claimants">Claimants ({grouped.length})</TabsTrigger>
          <TabsTrigger value="attorney">Attorney Report</TabsTrigger>
          <TabsTrigger value="active">Active Attorneys ({activeAttorneys.length})</TabsTrigger>
          <TabsTrigger value="reports">Report Catalogue</TabsTrigger>
          <TabsTrigger value="summary">Summary / Comments</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-3">
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Active Referring Attorneys · Matters since 1 Jan 2025
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activeAttorneys.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active referring attorneys found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Referring Attorney</TableHead>
                        <TableHead className="text-right">Matters (2025–Date)</TableHead>
                        <TableHead className="w-32 text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeAttorneys.map((a, i) => (
                        <TableRow key={a.name}>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-medium">{a.name}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">{a.matters}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setAttorneyFilter(a.name)}
                            >
                              Select
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attorney" className="space-y-3">
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Per-Attorney Report {attorneyFilter !== 'all' ? `· ${attorneyFilter}` : ''} · {periodLabel}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {attorneyFilter === 'all' && (
                <p className="text-sm text-muted-foreground">
                  Select a Referring Attorney from the filter above to build a tailored report.
                </p>
              )}
              {attorneyFilter !== 'all' && grouped.length === 0 && (
                <p className="text-sm text-muted-foreground">No claimants for this attorney in {periodLabel}.</p>
              )}
              {attorneyFilter !== 'all' && grouped.length > 0 && (
                <div className="rounded-md border border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Claimant Full Name</TableHead>
                        <TableHead className="text-center">Total Assessments</TableHead>
                        <TableHead className="text-center">Submitted</TableHead>
                        <TableHead className="text-center">In Progress</TableHead>
                        <TableHead className="text-center">Outstanding</TableHead>
                        <TableHead>Comment</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grouped.map((g) => {
                        const sub = g.items.filter((r) => isSubmitted(r.report_status)).length;
                        const ip = g.items.filter((r) => isInProgress(r.report_status)).length;
                        const out = g.items.length - sub - ip;
                        return (
                          <TableRow key={g.id}>
                            <TableCell className="font-medium">{g.name} <span className="text-xs text-muted-foreground">({g.auto_id})</span></TableCell>
                            <TableCell className="text-center">{g.items.length}</TableCell>
                            <TableCell className="text-center"><Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{sub}</Badge></TableCell>
                            <TableCell className="text-center"><Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">{ip}</Badge></TableCell>
                            <TableCell className="text-center"><Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">{out}</Badge></TableCell>
                            <TableCell className="min-w-[240px]">
                              <Textarea
                                rows={2}
                                value={claimantComments[g.id] ?? ''}
                                onChange={(e) => setClaimantComments((s) => ({ ...s, [g.id]: e.target.value }))}
                                placeholder="Add a comment for this claimant…"
                                className="text-xs"
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
              {attorneyFilter !== 'all' && grouped.length > 0 && (
                <div className="flex justify-end">
                  <Button onClick={exportAttorneyPDF} className="gap-2">
                    <Download className="h-4 w-4" /> Download Attorney PDF
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="claimants" className="space-y-3">
          <Card className="border-border/50">
            <CardHeader className="pb-2"><CardTitle className="text-base">Claimants in {periodLabel}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
              {!loading && grouped.length === 0 && <p className="text-sm text-muted-foreground">No data for this period.</p>}
              {grouped.map((g) => {
                const isOpen = !!openClaimants[g.id];
                const subSubmitted = g.items.filter((r) => isSubmitted(r.report_status)).length;
                const subProgress = g.items.filter((r) => isInProgress(r.report_status)).length;
                const subOut = g.items.length - subSubmitted - subProgress;
                return (
                  <Collapsible key={g.id} open={isOpen} onOpenChange={(o) => setOpenClaimants((s) => ({ ...s, [g.id]: o }))}>
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between p-3 rounded-md border border-border/50 hover:bg-muted/40 transition">
                        <div className="flex items-center gap-3 text-left">
                          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-0' : '-rotate-90'}`} />
                          <div>
                            <p className="font-medium text-sm">{g.name} <span className="text-muted-foreground">({g.auto_id})</span></p>
                            <p className="text-xs text-muted-foreground">{g.attorney ?? 'No attorney'} · {g.items.length} assessment{g.items.length > 1 ? 's' : ''}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-emerald-700 border-emerald-300">Submitted: {subSubmitted}</Badge>
                          <Badge variant="outline" className="text-amber-700 border-amber-300">In progress: {subProgress}</Badge>
                          <Badge variant="outline" className="text-rose-700 border-rose-300">Outstanding: {subOut}</Badge>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border border-t-0 border-border/50 rounded-b-md">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Appointment Date</TableHead>
                              <TableHead>Case Status</TableHead>
                              <TableHead>Report Status</TableHead>
                              <TableHead>Submitted On</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {g.items.map((r) => (
                              <TableRow key={r.appointment_id}>
                                <TableCell>{new Date(r.appointment_date).toLocaleDateString('en-ZA')}</TableCell>
                                <TableCell><Badge variant="secondary">{r.case_status ?? '—'}</Badge></TableCell>
                                <TableCell>
                                  <Badge className={
                                    isSubmitted(r.report_status) ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' :
                                    isInProgress(r.report_status) ? 'bg-amber-100 text-amber-700 hover:bg-amber-100' :
                                    'bg-rose-100 text-rose-700 hover:bg-rose-100'
                                  }>{r.report_status ?? 'pending'}</Badge>
                                </TableCell>
                                <TableCell>{r.report_submitted_date ? new Date(r.report_submitted_date).toLocaleDateString('en-ZA') : '—'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Reports available to send to a Referring Attorney</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {REPORT_TYPES.map((rt) => (
                  <div key={rt.id} className="flex items-start justify-between p-3 rounded-md border border-border/50 hover:bg-muted/30">
                    <div className="flex gap-3">
                      <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center">
                        <rt.icon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{rt.name}</p>
                        <p className="text-xs text-muted-foreground">{rt.desc}</p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="gap-2 shrink-0"
                      onClick={() => toast({ title: 'Prepared', description: `${rt.name} ready to send for ${periodLabel}.` })}>
                      <Mail className="h-3.5 w-3.5" /> Send
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary">
          <Card className="border-border/50">
            <CardHeader className="pb-2"><CardTitle className="text-base">Summary / Comments</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={`Add an executive summary or notes for the ${period} report (${periodLabel})…`}
                rows={8}
                maxLength={4000}
              />
              <p className="text-xs text-muted-foreground">{comment.length}/4000 characters · This summary is included in PDF exports.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminReportingDashboard;
