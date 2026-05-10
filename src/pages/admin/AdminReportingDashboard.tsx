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
  FileText, Calendar as CalendarIcon, DollarSign, TrendingUp, Briefcase, FileSpreadsheet, X,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addBrandingToPDF, addBrandingFooter, getStyledTableOptions } from '@/utils/pdfBranding';
import { formatExpertType } from '@/utils/expertTypeMapping';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';

type Period = 'monthly' | 'quarterly' | 'yearly' | 'bi_annually';

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

const STATUS_LABELS = {
  all: 'All Statuses',
  submitted: 'Submitted',
  in_progress: 'In Progress',
  outstanding: 'Outstanding',
} as const;

const getPeriodRange = (period: Period, year: number, month?: number, quarter?: number, half?: number) => {
  let start: Date, end: Date;
  if (period === 'monthly' && month != null) {
    start = new Date(year, month - 1, 1);
    end = new Date(year, month, 1);
  } else if (period === 'quarterly' && quarter != null) {
    start = new Date(year, (quarter - 1) * 3, 1);
    end = new Date(year, quarter * 3, 1);
  } else if (period === 'bi_annually' && half != null) {
    if (half === 1) {
      start = new Date(year, 0, 1);
      end = new Date(year, 6, 1);
    } else {
      start = new Date(year, 6, 1);
      end = new Date(year, 12, 1);
    }
  } else {
    start = new Date(year, 0, 1);
    end = new Date(year + 1, 0, 1);
  }
  return { start, end };
};

const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const normalizeAttorneyName = (name?: string | null) =>
  (name ?? '').replace(/\s+/g, ' ').trim();

const REPORT_TYPES = [
  { id: 'assessment_summary', name: 'Assessment Summary Report', icon: FileText, desc: 'Per-claimant grouped assessment overview with statuses' },
  { id: 'progress', name: 'Report Progress Update', icon: Clock, desc: 'In-progress reports and ETA per claimant' },
  { id: 'outstanding', name: 'Outstanding Reports Notice', icon: AlertTriangle, desc: 'Reports overdue or not yet submitted' },
  { id: 'submitted', name: 'Submitted Reports Confirmation', icon: FileCheck, desc: 'Confirmation list of all delivered reports' },
  { id: 'financial', name: 'Financial Statement', icon: DollarSign, desc: 'Fees, deposits, AODs and outstanding payments' },
  { id: 'case_status', name: 'Case Status Brief', icon: Briefcase, desc: 'Litigation phase per matter' },
  { id: 'appointment_schedule', name: 'Upcoming Appointment Schedule', icon: CalendarIcon, desc: 'Next appointments per claimant' },
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
  const [half, setHalf] = useState<number>(now.getMonth() < 6 ? 1 : 2);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [openClaimants, setOpenClaimants] = useState<Record<string, boolean>>({});
  const [attorneyFilter, setAttorneyFilter] = useState<string>('all');
  const [claimantComments, setClaimantComments] = useState<Record<string, string>>({});
  const [activeAttorneys, setActiveAttorneys] = useState<{ name: string; matters: number }[]>([]);
  const [pdfStatusFilter, setPdfStatusFilter] = useState<'all' | 'submitted' | 'in_progress' | 'outstanding'>('all');
  const [pdfDateRange, setPdfDateRange] = useState<DateRange | undefined>(undefined);

  const matchesPdfStatus = (status?: string | null) => {
    if (pdfStatusFilter === 'all') return true;
    if (pdfStatusFilter === 'submitted') return isSubmitted(status);
    if (pdfStatusFilter === 'in_progress') return isInProgress(status);
    return !isSubmitted(status) && !isInProgress(status); // outstanding
  };

  const matchesPdfDateRange = (dateStr?: string | null) => {
    if (!pdfDateRange?.from && !pdfDateRange?.to) return true;
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (pdfDateRange?.from) {
      const start = new Date(pdfDateRange.from);
      start.setHours(0, 0, 0, 0);
      if (d < start) return false;
    }
    if (pdfDateRange?.to) {
      const end = new Date(pdfDateRange.to);
      end.setHours(23, 59, 59, 999);
      if (d > end) return false;
    }
    return true;
  };

  const matchesPdfFilters = (r: { report_status?: string | null; appointment_date?: string | null }) =>
    matchesPdfStatus(r.report_status) && matchesPdfDateRange(r.appointment_date);

  const statusFilterLabel =
    pdfStatusFilter === 'all' ? 'All Statuses'
    : pdfStatusFilter === 'submitted' ? 'Submitted'
    : pdfStatusFilter === 'in_progress' ? 'In Progress'
    : 'Outstanding';

  const dateRangeLabel = pdfDateRange?.from
    ? `${format(pdfDateRange.from, 'dd MMM yyyy')}${pdfDateRange.to ? ` – ${format(pdfDateRange.to, 'dd MMM yyyy')}` : ''}`
    : 'All Dates';

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
            const name = normalizeAttorneyName(r.referring_attorney);
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
      const { start, end } = getPeriodRange(period, year, month, quarter, half);
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
        const scheduledAssessmentDate = a.appointment_date;
        return {
          appointment_id: a.id,
          appointment_date: scheduledAssessmentDate,
          case_status: a.case_status,
          claimant_id: c?.id ?? a.id,
          claimant_name: c ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() : 'Unknown',
          claimant_auto_id: c?.auto_id ?? '—',
          referring_attorney: normalizeAttorneyName(a.referring_attorney),
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

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [period, year, month, quarter, half]);

  // Show ALL attorneys that have assessments with us (since 2025), not just those in the current period
  const attorneyOptions = useMemo(() => {
    const set = new Set<string>(activeAttorneys.map((a) => a.name));
    rows.forEach((r) => {
      const name = normalizeAttorneyName(r.referring_attorney);
      if (name) set.add(name);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows, activeAttorneys]);

  const filteredRows = useMemo(() => {
    if (attorneyFilter === 'all') return rows;
    const selectedAttorneyName = normalizeAttorneyName(attorneyFilter);
    return rows.filter((r) => normalizeAttorneyName(r.referring_attorney) === selectedAttorneyName);
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
    if (period === 'bi_annually') return `H${half} ${year}`;
    return `${year}`;
  }, [period, year, month, quarter, half]);

  // Wrap text to a max width and draw centered/left, returning the y after the block
  const drawWrappedText = (
    doc: jsPDF,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    options?: { align?: 'left' | 'center' | 'right' }
  ) => {
    const lines = doc.splitTextToSize(String(text ?? ''), maxWidth) as string[];
    lines.forEach((line, i) => {
      doc.text(line, x, y + i * lineHeight, options?.align ? { align: options.align } : undefined);
    });
    return y + lines.length * lineHeight;
  };

  // Cover page with report metadata
  const drawCoverPage = (doc: jsPDF, title: string, attorneyName?: string) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const sideMargin = 14;
    const maxTextWidth = pageWidth - sideMargin * 2;

    // Teal banner top
    doc.setFillColor(31, 182, 206);
    doc.rect(0, 0, pageWidth, 38, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(20);
    drawWrappedText(doc, 'Kutlwano & Associate (Pty) Ltd', pageWidth / 2, 18, maxTextWidth, 8, { align: 'center' });
    doc.setFont(undefined, 'normal');
    doc.setFontSize(11);
    drawWrappedText(doc, 'Medico-Legal Reports', pageWidth / 2, 28, maxTextWidth, 6, { align: 'center' });

    // Title block (wrapped)
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(24);
    const titleLines = doc.splitTextToSize(title, maxTextWidth) as string[];
    let titleY = pageHeight / 2 - 30;
    titleLines.forEach((ln, i) => doc.text(ln, pageWidth / 2, titleY + i * 10, { align: 'center' }));
    titleY += titleLines.length * 10;

    if (attorneyName) {
      doc.setFontSize(14);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(60, 60, 60);
      drawWrappedText(doc, attorneyName, pageWidth / 2, titleY, maxTextWidth, 7, { align: 'center' });
    }

    // Metadata box (auto-sized to wrapped values)
    const boxW = 180;
    const boxX = pageWidth / 2 - boxW / 2;
    const labelW = 50;
    const valueX = boxX + 6 + labelW;
    const valueMaxW = boxW - (valueX - boxX) - 6;

    const periodText = getPDFPeriodDisplay();
    const generatedText = new Date().toLocaleString('en-ZA', {
      timeZone: 'Africa/Johannesburg', year: 'numeric', month: 'long', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });

    const rows: [string, string][] = [
      ['Reporting Period:', periodText],
      ['Date Range:', getPDFPeriodRangeText()],
      ['Status Filter:', statusFilterLabel],
      ['Generated:', `${generatedText} (SAST)`],
    ];

    doc.setFontSize(10);
    // Pre-compute total height
    const lineH = 5;
    const rowGap = 4;
    const wrappedRows = rows.map(([k, v]) => ({
      k,
      vLines: doc.splitTextToSize(v, valueMaxW) as string[],
    }));
    const contentH = wrappedRows.reduce((acc, r) => acc + Math.max(1, r.vLines.length) * lineH + rowGap, 0) + 6;
    const boxH = Math.max(60, contentH);
    const boxY = pageHeight / 2 - 5;

    doc.setDrawColor(31, 182, 206);
    doc.setLineWidth(0.5);
    doc.setFillColor(245, 247, 250);
    doc.rect(boxX, boxY, boxW, boxH, 'FD');

    let ry = boxY + 10;
    wrappedRows.forEach(({ k, vLines }) => {
      doc.setFont(undefined, 'bold');
      doc.setTextColor(31, 182, 206);
      doc.text(k, boxX + 6, ry);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(40, 40, 40);
      vLines.forEach((ln, i) => doc.text(ln, valueX, ry + i * lineH));
      ry += Math.max(1, vLines.length) * lineH + rowGap;
    });

    doc.addPage();
  };

  // Shared helpers for polished PDF styling (teal header + alternating rows)
  const drawSectionTitle = (doc: jsPDF, title: string, y: number) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const padX = 4;
    const maxTextWidth = pageWidth - 20 - padX * 2;
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    const lines = doc.splitTextToSize(title, maxTextWidth) as string[];
    const lineH = 5;
    const barH = Math.max(7, lines.length * lineH + 2);
    doc.setFillColor(31, 182, 206);
    doc.rect(10, y, pageWidth - 20, barH, 'F');
    doc.setTextColor(255, 255, 255);
    lines.forEach((ln, i) => doc.text(ln, 14, y + 5 + i * lineH));
    doc.setFont(undefined, 'normal');
    doc.setTextColor(0, 0, 0);
    return y + barH + 2;
  };

  const drawKpiSummaryTable = (doc: jsPDF, startY: number) => {
    const filteredCount = grouped.reduce((acc, g) => acc + g.items.filter((r) => matchesPdfFilters(r)).length, 0);
    const showAll = pdfStatusFilter === 'all';
    const head = showAll
      ? [['Claimants', 'Total Assessments', 'Submitted', 'In Progress', 'Outstanding']]
      : [['Claimants', 'Total Assessments', statusFilterLabel]];
    const body = showAll
      ? [[
          String(metrics.totalClaimants),
          String(metrics.totalAssessments),
          String(metrics.submitted),
          String(metrics.inProgress),
          String(metrics.outstanding),
        ]]
      : [[String(metrics.totalClaimants), String(metrics.totalAssessments), String(filteredCount)]];

    autoTable(doc, {
      startY,
      head,
      body,
      theme: 'grid',
      headStyles: {
        fillColor: [31, 182, 206],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 10,
        halign: 'center',
        cellPadding: 3,
      },
      bodyStyles: {
        fontSize: 11,
        halign: 'center',
        cellPadding: 4,
        textColor: [40, 40, 40],
      },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      styles: { lineColor: [220, 226, 232], lineWidth: 0.2 },
      margin: { left: 10, right: 10 },
    });
    return (doc as any).lastAutoTable?.finalY ?? startY + 14;
  };

  const getPDFReportTitle = () => {
    if (pdfStatusFilter === 'submitted') return 'Submitted Reports';
    if (pdfStatusFilter === 'outstanding') return 'Outstanding Reports';
    return 'Medico-Legal Reports';
  };

  const getPDFPeriodRangeText = () => {
    const { start, end } = getPeriodRange(period, year, month, quarter, half);
    const startDate = new Date(start);
    const endDate = new Date(end);
    endDate.setDate(endDate.getDate() - 1);
    const fmtFull = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    return `${fmtFull(startDate)} to ${fmtFull(endDate)}`;
  };

  const getPDFPeriodDisplay = () => {
    if (period === 'monthly') return 'Monthly';
    if (period === 'quarterly') return `Q${quarter} ${year}`;
    if (period === 'bi_annually') return 'Bi-Annually';
    if (period === 'yearly') return `Yearly (${year})`;
    return periodLabel;
  };

  const addPageNumbersToPDF = (doc: jsPDF) => {
    const pageCount = (doc as any).internal.getNumberOfPages();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.setFont(undefined, 'normal');
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    if (attorneyFilter === 'all') {
      toast({ title: 'Select a referring attorney', description: 'Please select a referring attorney / law firm before exporting.', variant: 'destructive' });
      return;
    }
    const reportTitle = getPDFReportTitle();
    const periodDisplay = getPDFPeriodDisplay();
    const subtitle = pdfStatusFilter === 'submitted' || pdfStatusFilter === 'outstanding'
      ? attorneyFilter
      : `${attorneyFilter} · ${periodDisplay} · ${statusFilterLabel}`;
    drawCoverPage(doc, reportTitle, attorneyFilter);
    const startY = addBrandingToPDF(doc, reportTitle, subtitle);

    // Polished KPI summary block (teal header, screenshot-style)
    let cursorY = drawSectionTitle(doc, 'Performance Summary', startY);
    cursorY = drawKpiSummaryTable(doc, cursorY) + 4;
    cursorY = drawSectionTitle(doc, 'Assessment Detail', cursorY);

    const head = [['Claimant ID', 'Claimant Full Name', 'Referring Attorney', 'Appointment Date', 'Expert Type', 'Case Status', 'Report Status', 'Submitted On']];
    const body: string[][] = [];
    grouped.forEach((g) => {
      const filteredItems = g.items.filter((r) => matchesPdfFilters(r));
      filteredItems.forEach((r, idx) => {
        body.push([
          idx === 0 ? g.auto_id : '',
          idx === 0 ? g.name : '',
          idx === 0 ? (g.attorney ?? '') : '',
          new Date(r.appointment_date).toLocaleDateString('en-ZA'),
          r.expert_type ? formatExpertType(r.expert_type) : '—',
          r.case_status ? r.case_status : '—',
          isSubmitted(r.report_status) ? 'Submitted' : isInProgress(r.report_status) ? 'In Progress' : 'Outstanding',
          r.report_submitted_date ? new Date(r.report_submitted_date).toLocaleDateString('en-ZA') : '—',
        ]);
      });
    });

    if (body.length === 0) {
      toast({ title: 'No matching rows', description: `No reports match "${statusFilterLabel}" for this period.`, variant: 'destructive' });
      return;
    }

    const tableOptions = getStyledTableOptions();
    autoTable(doc, {
      startY: cursorY,
      head,
      body,
      ...tableOptions,
      theme: 'grid',
      styles: { ...tableOptions.styles, fontSize: 9, cellPadding: 3, valign: 'middle', lineColor: [220, 226, 232], lineWidth: 0.2 },
      headStyles: { ...tableOptions.headStyles, fontSize: 9, halign: 'center', cellPadding: 3 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        0: { cellWidth: 26 },
        1: { cellWidth: 50 },
        2: { cellWidth: 45 },
        3: { cellWidth: 26, halign: 'center' },
        4: { cellWidth: 32 },
        5: { cellWidth: 28, halign: 'center' },
        6: { cellWidth: 30, halign: 'center' },
        7: { cellWidth: 'auto', halign: 'center' },
      },
      margin: { left: 10, right: 10 },
    });

    if (comment.trim()) {
      const finalY = (doc as any).lastAutoTable?.finalY ?? cursorY + 20;
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text('Summary / Comments', 14, finalY + 10);
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      const lines = doc.splitTextToSize(comment, 270);
      doc.text(lines, 14, finalY + 16);
    }

    addBrandingFooter(doc);
    addPageNumbersToPDF(doc);
    const safeStatus = statusFilterLabel.replace(/[^a-z0-9]+/gi, '_');
    const safeDateRange = dateRangeLabel.replace(/[^a-z0-9]+/gi, '_');
    doc.save(`reporting-${period}-${periodLabel.replace(/\s+/g, '_')}-${safeStatus}-${safeDateRange}.pdf`);
    toast({ title: 'Export ready', description: `${period} PDF report exported.` });
  };

  const exportAttorneyPDF = () => {
    if (attorneyFilter === 'all') {
      toast({ title: 'Select an attorney', description: 'Choose a referring attorney to generate this report.', variant: 'destructive' });
      return;
    }
    const doc = new jsPDF({ orientation: 'landscape' });
    const reportTitleAtt = getPDFReportTitle();
    const periodDisplayAtt = getPDFPeriodDisplay();
    const subtitleAtt = pdfStatusFilter === 'submitted' || pdfStatusFilter === 'outstanding'
      ? attorneyFilter
      : `${attorneyFilter} · ${periodDisplayAtt} · ${statusFilterLabel}`;
    drawCoverPage(doc, reportTitleAtt, attorneyFilter);
    const startY = addBrandingToPDF(doc, reportTitleAtt, subtitleAtt);

    // Polished KPI summary block (teal header, screenshot-style)
    let cursorY = drawSectionTitle(doc, 'Performance Summary', startY);
    cursorY = drawKpiSummaryTable(doc, cursorY) + 4;
    cursorY = drawSectionTitle(doc, 'Per-Claimant Breakdown', cursorY);

    const showAll = pdfStatusFilter === 'all';
    const head = showAll
      ? [['Claimant Full Name', 'Total Assessments', 'Submitted', 'In Progress', 'Outstanding', 'Comment']]
      : [['Claimant Full Name', 'Total Assessments', statusFilterLabel, 'Comment']];
    const body = grouped
      .map((g) => {
        const items = g.items.filter((r) => matchesPdfFilters(r));
        const sub = items.filter((r) => isSubmitted(r.report_status)).length;
        const ip = items.filter((r) => isInProgress(r.report_status)).length;
        const out = items.length - sub - ip;
        const expertTypes = Array.from(new Set(
          items.map((r) => r.expert_type ? formatExpertType(r.expert_type) : null).filter(Boolean) as string[]
        ));
        const nameCell = expertTypes.length
          ? `${g.name} (${g.auto_id})\nExperts: ${expertTypes.join(', ')}`
          : `${g.name} (${g.auto_id})`;
        const row = showAll
          ? [nameCell, String(items.length), String(sub), String(ip), String(out), claimantComments[g.id] ?? '']
          : [nameCell, String(items.length), String(items.length), claimantComments[g.id] ?? ''];
        return { items, row };
      })
      .filter((g) => g.items.length > 0)
      .map((g) => g.row);

    if (body.length === 0) {
      toast({ title: 'No matching rows', description: `No reports match "${statusFilterLabel}" for this period.`, variant: 'destructive' });
      return;
    }

    const tableOptions = getStyledTableOptions();
    autoTable(doc, {
      startY: cursorY,
      head,
      body,
      ...tableOptions,
      theme: 'grid',
      styles: { ...tableOptions.styles, fontSize: 9, cellPadding: 4, valign: 'middle', lineColor: [220, 226, 232], lineWidth: 0.2 },
      headStyles: { ...tableOptions.headStyles, fontSize: 10, halign: 'center', cellPadding: 3 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: showAll
        ? {
            0: { cellWidth: 70, valign: 'top' },
            1: { cellWidth: 28, halign: 'center' },
            2: { cellWidth: 28, halign: 'center' },
            3: { cellWidth: 28, halign: 'center' },
            4: { cellWidth: 28, halign: 'center' },
            5: { cellWidth: 'auto' },
          }
        : {
            0: { cellWidth: 80, valign: 'top' },
            1: { cellWidth: 32, halign: 'center' },
            2: { cellWidth: 32, halign: 'center' },
            3: { cellWidth: 'auto' },
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
    addPageNumbersToPDF(doc);
    const safeName = attorneyFilter.replace(/[^a-z0-9]+/gi, '_');
    const safeStatusAtt = statusFilterLabel.replace(/[^a-z0-9]+/gi, '_');
    const safeDateRangeAtt = dateRangeLabel.replace(/[^a-z0-9]+/gi, '_');
    doc.save(`attorney-${safeName}-${period}-${periodLabel.replace(/\s+/g, '_')}-${safeStatusAtt}-${safeDateRangeAtt}.pdf`);
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
              <SelectItem value="bi_annually">Bi-Annually</SelectItem>
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
          {period === 'bi_annually' && (
            <Select value={String(half)} onValueChange={(v) => setHalf(Number(v))}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">H1</SelectItem>
                <SelectItem value="2">H2</SelectItem>
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
          <Select value={pdfStatusFilter} onValueChange={(v: typeof pdfStatusFilter) => setPdfStatusFilter(v)}>
            <SelectTrigger className="w-44"><SelectValue placeholder="PDF status filter" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="submitted">Submitted Reports</SelectItem>
              <SelectItem value="in_progress">In Process</SelectItem>
              <SelectItem value="outstanding">Outstanding</SelectItem>
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  'gap-2 justify-start text-left font-normal',
                  !pdfDateRange?.from && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="h-4 w-4" />
                {dateRangeLabel}
                {pdfDateRange?.from && (
                  <X
                    className="h-3 w-3 ml-1 opacity-60 hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); setPdfDateRange(undefined); }}
                  />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={pdfDateRange}
                onSelect={setPdfDateRange}
                numberOfMonths={2}
                initialFocus
                className={cn('p-3 pointer-events-auto')}
              />
            </PopoverContent>
          </Popover>
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
