import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VirtualizedMultiSelect } from '@/components/ui/virtualized-multi-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  DollarSign, AlertTriangle, CheckCircle2, FileText,
  TrendingDown, RefreshCw, Search, X, CalendarClock, Flame,
  Download, Mail, ChevronDown, ChevronUp, History, ThumbsUp, ThumbsDown, ArrowRightCircle, Save, Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addBrandingToPDF, addBrandingFooter, getStyledTableOptions } from '@/utils/pdfBranding';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

type ExpertPayStatus = 'Urgent' | 'Planned to pay' | 'Partially paid' | 'Fully paid' | 'Unpaid';
type ApprovalStatus = 'pending' | 'approved' | 'not_approved' | 'moved_next';
interface PlanState {
  urgent: boolean;
  planned: boolean;
  partial: number;
  comment: string;
  expertPaymentOverride?: ExpertPayStatus | null;
  decision?: ApprovalStatus;
  decidedAt?: string | null;
}
const EMPTY_PLAN: PlanState = { urgent: false, planned: false, partial: 0, comment: '', expertPaymentOverride: null, decision: 'pending', decidedAt: null };
const EXPERT_PAY_OPTIONS: ExpertPayStatus[] = ['Urgent', 'Planned to pay', 'Partially paid', 'Fully paid', 'Unpaid'];
const EXPERT_PAY_STYLE: Record<ExpertPayStatus, string> = {
  'Urgent': 'bg-rose-100 text-rose-800 border-rose-300',
  'Planned to pay': 'bg-blue-100 text-blue-800 border-blue-200',
  'Partially paid': 'bg-amber-100 text-amber-800 border-amber-200',
  'Fully paid': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Unpaid': 'bg-rose-50 text-rose-700 border-rose-200',
};
const DECISION_LABEL: Record<ApprovalStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  not_approved: 'Not approved',
  moved_next: 'Move to next payment',
};
const DECISION_STYLE: Record<ApprovalStatus, string> = {
  pending: 'bg-slate-100 text-slate-700 border-slate-200',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  not_approved: 'bg-rose-100 text-rose-800 border-rose-300',
  moved_next: 'bg-indigo-100 text-indigo-800 border-indigo-300',
};
const PLAN_STORAGE_KEY = 'epp_plan_state_v1';
const HISTORY_STORAGE_KEY = 'epp_history_v1';

interface HistorySnapshot {
  id: string;
  label: string;
  created_at: string;
  filters: {
    dateFrom: string; dateTo: string; search: string;
    attorneyPay: string; expertPay: string; profession: string;
    report: string; paidStatus: string; decision: string;
  };
  totals: {
    rows: number; attorneys: number;
    plannedAmount: number; urgentAmount: number;
    approvedAmount: number; approvedCount: number;
    notApprovedCount: number; movedNextCount: number;
    pendingCount: number;
  };
  entries: Array<{
    appointment_id: string;
    attorney_name: string; expert_name: string; patient_name: string;
    assessment_date: string;
    fee_due: number; partial: number; to_pay: number;
    urgent: boolean; planned: boolean;
    decision: ApprovalStatus;
    comment: string;
  }>;
}

/**
 * Expert Payment Planner — mirrors the "Payments to be made" spreadsheet.
 * Rows = appointments (grouped per Referring Attorney) with per-attorney subtotals:
 *   - Total expert debts        (Σ Fee due to expert)
 *   - Attorneys total debt      (Σ Service fee)
 *   - Deposit paid by attorney  (Σ Deposit amount)
 *   - Attorneys outstanding bal (debt − deposit, clamped at R0)
 *
 * Data sources:
 *   - Experts:   Expert Credit Control (medical_experts via get_medical_experts_secure + expert_payments)
 *   - Attorneys: Scheduled Assessment   (appointments + referring_attorneys)
 *   - Reports:   expert_reports (Report received yes/no)
 */

type AttorneyPay = 'Fully paid' | 'Partially paid' | 'Unpaid';
type ExpertPay = 'fully paid' | 'partially paid' | 'Unpaid';

interface PlannerRow {
  appointment_id: string;
  assessment_date: string;
  expert_id: string;
  expert_name: string;
  expert_type: string;
  patient_name: string;
  matter_type: string;
  attorney_id: string;
  attorney_name: string;
  attorney_payment: AttorneyPay;
  payment_date: string | null;
  expert_payment: ExpertPay;
  report_received: 'yes' | 'no';
  fee_due_to_expert: number;
  service_fee: number;
  deposit_amount: number;
}

const ZAR = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(n || 0);

const PAY_STYLE: Record<string, string> = {
  'Fully paid': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Partially paid': 'bg-amber-100 text-amber-800 border-amber-200',
  'Unpaid': 'bg-rose-100 text-rose-800 border-rose-200',
  'fully paid': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'partially paid': 'bg-amber-100 text-amber-800 border-amber-200',
};

const DATA_WINDOW_START = '2025-01-01';

const AdminExpertPaymentPlanner: React.FC = () => {
  const [rows, setRows] = useState<PlannerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ step: string; message: string } | null>(null);

  // Filter options
  const [allAttorneys, setAllAttorneys] = useState<Array<{ id: string; firm_name: string }>>([]);
  const [allExperts, setAllExperts] = useState<Array<{ id: string; full_name: string }>>([]);
  const [allProfessions, setAllProfessions] = useState<string[]>([]);
  const [filterOptionsLoading, setFilterOptionsLoading] = useState(true);

  // Filters
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [attorneyFilter, setAttorneyFilter] = useState<string[]>([]);
  const [expertFilter, setExpertFilter] = useState<string[]>([]);
  const [professionFilter, setProfessionFilter] = useState<string>('all');
  const [attorneyPayFilter, setAttorneyPayFilter] = useState<string>('all');
  const [expertPayFilter, setExpertPayFilter] = useState<string>('all');
  const [reportFilter, setReportFilter] = useState<string>('all');
  const [paidStatusFilter, setPaidStatusFilter] = useState<string>('all'); // all | paid | unpaid (expert side)
  const [decisionFilter, setDecisionFilter] = useState<string>('all'); // all | pending | approved | not_approved | moved_next
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Editable per-row planner state (urgent/planned/partial/comment), persisted locally.
  const [plan, setPlan] = useState<Record<string, PlanState>>(() => {
    try {
      const raw = localStorage.getItem(PLAN_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan)); } catch {}
  }, [plan]);
  const getPlan = (id: string): PlanState => plan[id] ?? EMPTY_PLAN;
  const setPlanField = <K extends keyof PlanState>(id: string, key: K, value: PlanState[K]) =>
    setPlan(prev => ({ ...prev, [id]: { ...(prev[id] ?? EMPTY_PLAN), [key]: value } }));

  const load = async () => {
    setLoading(true);
    let step = 'initialize';
    const todayIso = new Date().toISOString().slice(0, 10);
    try {
      step = 'fetch appointments (Scheduled Assessment)';
      let aptQ = supabase
        .from('appointments')
        .select(`
          id, appointment_date, payment_status, payment_date, matter_type,
          service_fee, deposit_amount, expert_id, claimant_id, referring_attorney_id,
          claimants:claimants!inner(first_name, last_name),
          medical_experts:medical_experts!inner(first_name, last_name, expert_type, consultation_fees, court_fees),
          referring_attorneys:referring_attorneys!inner(id, name, is_system_company)
        `)
        .is('deleted_at', null)
        .gte('appointment_date', dateFrom || DATA_WINDOW_START)
        .lte('appointment_date', dateTo || todayIso)
        .order('appointment_date', { ascending: false })
        .limit(2000);

      if (attorneyFilter.length) aptQ = aptQ.in('referring_attorney_id', attorneyFilter);
      if (expertFilter.length) aptQ = aptQ.in('expert_id', expertFilter);

      const { data: apts, error: aptErr } = await aptQ;
      if (aptErr) throw aptErr;

      const aptIds = (apts ?? []).map((a: any) => a.id);

      step = 'fetch expert_payments (Expert Credit Control)';
      const { data: payments, error: payErr } = aptIds.length
        ? await supabase.from('expert_payments').select('appointment_id, payment_amount').in('appointment_id', aptIds)
        : { data: [] as any[], error: null };
      if (payErr) throw payErr;

      step = 'fetch expert_reports';
      const { data: reports, error: repErr } = aptIds.length
        ? await supabase.from('expert_reports').select('appointment_id, report_status').in('appointment_id', aptIds)
        : { data: [] as any[], error: null };
      if (repErr) throw repErr;

      const paidByApt = new Map<string, number>();
      (payments ?? []).forEach((p: any) => {
        paidByApt.set(p.appointment_id, (paidByApt.get(p.appointment_id) || 0) + Number(p.payment_amount || 0));
      });
      const reportByApt = new Map<string, string>();
      (reports ?? []).forEach((r: any) => reportByApt.set(r.appointment_id, r.report_status));

      step = 'shape planner rows';
      const shaped: PlannerRow[] = (apts ?? [])
        .filter((a: any) => {
          const att = Array.isArray(a.referring_attorneys) ? a.referring_attorneys[0] : a.referring_attorneys;
          if (!att) return false;
          if (att.is_system_company) return false;
          if (/kutlwano\s*associate/i.test(att.name || '')) return false;
          return true;
        })
        .map((a: any) => {
          const claimant = Array.isArray(a.claimants) ? a.claimants[0] : a.claimants;
          const expert = Array.isArray(a.medical_experts) ? a.medical_experts[0] : a.medical_experts;
          const att = Array.isArray(a.referring_attorneys) ? a.referring_attorneys[0] : a.referring_attorneys;

          const consult = Number(expert?.consultation_fees || 0);
          const court = Number(expert?.court_fees || 0);
          const courtUsed = (a.matter_type || '').toLowerCase().includes('court');
          const totalDue = consult + (courtUsed ? court : 0);
          const paid = paidByApt.get(a.id) || 0;
          const feeDue = Math.max(0, totalDue - paid);

          let expertPayment: ExpertPay = 'Unpaid';
          if (paid >= totalDue && totalDue > 0) expertPayment = 'fully paid';
          else if (paid > 0) expertPayment = 'partially paid';

          const aps = (a.payment_status || '').toString().toLowerCase();
          const attorneyPayment: AttorneyPay =
            aps === 'paid' ? 'Fully paid' :
            aps === 'partial' || aps === 'partially_paid' ? 'Partially paid' :
            'Unpaid';

          const rs = (reportByApt.get(a.id) || '').toLowerCase();
          const reportReceived: 'yes' | 'no' =
            ['completed', 'report fully paid & submitted', 'taken_out', 'taken out', 'submitted'].includes(rs)
              ? 'yes' : 'no';

          return {
            appointment_id: a.id,
            assessment_date: a.appointment_date,
            expert_id: a.expert_id,
            expert_name: expert ? `${expert.first_name ?? ''} ${expert.last_name ?? ''}`.trim() : '—',
            expert_type: expert?.expert_type ?? '—',
            patient_name: claimant ? `${claimant.first_name ?? ''} ${claimant.last_name ?? ''}`.trim() : '—',
            matter_type: a.matter_type || '—',
            attorney_id: att.id,
            attorney_name: att.name,
            attorney_payment: attorneyPayment,
            payment_date: a.payment_date,
            expert_payment: expertPayment,
            report_received: reportReceived,
            fee_due_to_expert: feeDue,
            service_fee: Number(a.service_fee || 0),
            deposit_amount: Number(a.deposit_amount || 0),
          } as PlannerRow;
        });

      setRows(shaped);
      setLoadError(null);
      toast.success(`Fetched ${shaped.length} appointment${shaped.length === 1 ? '' : 's'}`);
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.error(`[ExpertPaymentPlanner] ${step} failed:`, err);
      setLoadError({ step, message: msg });
      toast.error(`Failed at: ${step}`, { description: msg });
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter option loading — experts from Credit Control, attorneys from Scheduled Assessment.
  const loadFilterOptions = async () => {
    setFilterOptionsLoading(true);
    try {
      const [expRes, aptRes, attRes] = await Promise.all([
        supabase.rpc('get_medical_experts_secure'),
        supabase.from('appointments').select('expert_id, referring_attorney_id, appointment_date')
          .gte('appointment_date', DATA_WINDOW_START).is('deleted_at', null).limit(10000),
        supabase.from('referring_attorneys').select('id, name, is_system_company').order('name').limit(10000),
      ]);
      if (expRes.error) throw expRes.error;
      if (aptRes.error) throw aptRes.error;
      if (attRes.error) throw attRes.error;

      const activeExpertIds = new Set<string>((aptRes.data ?? []).map((x: any) => x.expert_id).filter(Boolean));
      const activeAttorneyIds = new Set<string>((aptRes.data ?? []).map((x: any) => x.referring_attorney_id).filter(Boolean));

      const experts = (expRes.data ?? []).filter((e: any) => activeExpertIds.has(e.id));
      setAllExperts(experts.map((e: any) => ({
        id: e.id,
        full_name: `${e.first_name ?? ''} ${e.last_name ?? ''}`.trim(),
      })));
      setAllProfessions(Array.from(new Set(experts.map((e: any) => e.expert_type).filter(Boolean))).sort() as string[]);

      const atts = (attRes.data ?? [])
        .filter((a: any) => !a.is_system_company && !/kutlwano\s*associate/i.test(a.name || ''))
        .filter((a: any) => activeAttorneyIds.has(a.id))
        .map((a: any) => ({ id: a.id, firm_name: a.name }));
      setAllAttorneys(atts);

      toast.success(`Loaded ${atts.length} attorneys & ${experts.length} experts`);
    } catch (err: any) {
      toast.error('Failed to load filter options', { description: err?.message || String(err) });
    } finally {
      setFilterOptionsLoading(false);
    }
  };

  useEffect(() => { loadFilterOptions(); load(); /* eslint-disable-next-line */ }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (professionFilter !== 'all' && r.expert_type !== professionFilter) return false;
      if (attorneyPayFilter !== 'all' && r.attorney_payment !== attorneyPayFilter) return false;
      if (expertPayFilter !== 'all' && r.expert_payment !== expertPayFilter) return false;
      if (reportFilter !== 'all' && r.report_received !== reportFilter) return false;
      if (paidStatusFilter === 'paid' && r.expert_payment !== 'fully paid') return false;
      if (paidStatusFilter === 'unpaid' && r.expert_payment === 'fully paid') return false;
      if (q) {
        const hay = [r.expert_name, r.attorney_name, r.patient_name, r.expert_type, r.matter_type]
          .join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, professionFilter, attorneyPayFilter, expertPayFilter, reportFilter, paidStatusFilter]);

  // Group by attorney for spreadsheet-style display
  const grouped = useMemo(() => {
    const map = new Map<string, { attorney_name: string; rows: PlannerRow[] }>();
    for (const r of filtered) {
      const k = r.attorney_id;
      if (!map.has(k)) map.set(k, { attorney_name: r.attorney_name, rows: [] });
      map.get(k)!.rows.push(r);
    }
    return Array.from(map.entries())
      .map(([attorney_id, g]) => {
        const totalExpertDebts = g.rows.reduce((s, r) => s + r.fee_due_to_expert, 0);
        const attorneyDebt = g.rows.reduce((s, r) =>
          s + (r.attorney_payment === 'Fully paid' ? 0 : r.service_fee), 0);
        const deposit = g.rows.reduce((s, r) => s + r.deposit_amount, 0);
        const outstanding = Math.max(0, attorneyDebt - deposit);
        const plannedTotal = g.rows.reduce((s, r) => {
          const p = getPlan(r.appointment_id);
          if (!p.planned && !p.urgent) return s;
          const owed = Math.max(0, r.fee_due_to_expert - (Number(p.partial) || 0));
          return s + owed;
        }, 0);
        const urgentTotal = g.rows.reduce((s, r) => {
          const p = getPlan(r.appointment_id);
          if (!p.urgent) return s;
          return s + Math.max(0, r.fee_due_to_expert - (Number(p.partial) || 0));
        }, 0);
        const partialTotal = g.rows.reduce((s, r) => s + (Number(getPlan(r.appointment_id).partial) || 0), 0);
        return { attorney_id, attorney_name: g.attorney_name, rows: g.rows, totalExpertDebts, attorneyDebt, deposit, outstanding, plannedTotal, urgentTotal, partialTotal };
      })
      .sort((a, b) => a.attorney_name.localeCompare(b.attorney_name));
  }, [filtered, plan]);

  const kpis = useMemo(() => {
    const totalExpertDebt = filtered.reduce((s, r) => s + r.fee_due_to_expert, 0);
    const totalAttorneyDebt = filtered.reduce((s, r) =>
      s + (r.attorney_payment === 'Fully paid' ? 0 : r.service_fee), 0);
    const totalDeposits = filtered.reduce((s, r) => s + r.deposit_amount, 0);
    const outstanding = Math.max(0, totalAttorneyDebt - totalDeposits);
    const reportsReceived = filtered.filter(r => r.report_received === 'yes').length;
    const filesToBePaid = filtered.filter(r => r.expert_payment !== 'fully paid').length;
    const plannedSelected = filtered.filter(r => { const p = getPlan(r.appointment_id); return p.planned || p.urgent; }).length;
    const urgentSelected = filtered.filter(r => getPlan(r.appointment_id).urgent).length;
    const plannedAmount = filtered.reduce((s, r) => {
      const p = getPlan(r.appointment_id);
      if (!p.planned && !p.urgent) return s;
      return s + Math.max(0, r.fee_due_to_expert - (Number(p.partial) || 0));
    }, 0);
    const urgentAmount = filtered.reduce((s, r) => {
      const p = getPlan(r.appointment_id);
      if (!p.urgent) return s;
      return s + Math.max(0, r.fee_due_to_expert - (Number(p.partial) || 0));
    }, 0);
    return { totalExpertDebt, totalAttorneyDebt, totalDeposits, outstanding, reportsReceived, filesToBePaid, totalRows: filtered.length, plannedSelected, urgentSelected, plannedAmount, urgentAmount };
  }, [filtered, plan]);

  const clearFilters = () => {
    setSearch(''); setSearchInput(''); setAttorneyFilter([]); setExpertFilter([]);
    setProfessionFilter('all'); setAttorneyPayFilter('all'); setExpertPayFilter('all');
    setReportFilter('all'); setPaidStatusFilter('all'); setDateFrom(''); setDateTo('');
    load();
  };

  // RFC 5322-lite email regex with single TLD requirement (no leading/trailing dots, no consecutive dots)
  const EMAIL_RE = /^(?!\.)(?!.*\.\.)[A-Za-z0-9._%+\-]+(?<!\.)@[A-Za-z0-9](?:[A-Za-z0-9\-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9\-]{0,61}[A-Za-z0-9])?)*\.[A-Za-z]{2,24}$/;
  const validateEmailList = (raw: string, required: boolean): { error: string | null; emails: string[] } => {
    const trimmed = (raw || '').trim();
    if (!trimmed) {
      return { error: required ? 'At least one recipient email is required' : null, emails: [] };
    }
    const parts = trimmed.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
    if (!parts.length) {
      return { error: required ? 'At least one recipient email is required' : null, emails: [] };
    }
    const invalid = parts.filter(p => p.length > 254 || !EMAIL_RE.test(p));
    if (invalid.length) {
      return { error: `Invalid email${invalid.length > 1 ? 's' : ''}: ${invalid.slice(0, 3).join(', ')}${invalid.length > 3 ? '…' : ''}`, emails: parts };
    }
    const seen = new Set<string>();
    const dups: string[] = [];
    for (const p of parts) {
      const k = p.toLowerCase();
      if (seen.has(k)) dups.push(p); else seen.add(k);
    }
    if (dups.length) return { error: `Duplicate email: ${dups[0]}`, emails: parts };
    return { error: null, emails: parts };
  };

  // ===== Export PDF / Email =====
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailCc, setEmailCc] = useState('');
  const [emailToError, setEmailToError] = useState<string | null>(null);
  const [emailCcError, setEmailCcError] = useState<string | null>(null);
  const [emailSubject, setEmailSubject] = useState('Expert Payment Planner');
  const [emailMessage, setEmailMessage] = useState(
    'Please find attached the latest Expert Payment Planner with planned and urgent payments per attorney.'
  );
  const [sending, setSending] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  const buildPlannerPdf = (): { doc: jsPDF; filename: string } => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const subtitle = `${grouped.length} attorney${grouped.length === 1 ? '' : 's'} · ${filtered.length} file${filtered.length === 1 ? '' : 's'}`;
    const startY = addBrandingToPDF(doc, 'Expert Payment Planner — Payments To Be Made', subtitle);

    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    const kpiLines = [
      `Total To Be Paid (Selected): ${ZAR(kpis.plannedAmount)}    Urgent To Pay: ${ZAR(kpis.urgentAmount)}    Selected Files: ${kpis.plannedSelected} (${kpis.urgentSelected} urgent)`,
      `Total Expert Debt: ${ZAR(kpis.totalExpertDebt)}    Attorneys Outstanding: ${ZAR(kpis.outstanding)}    Files To Be Paid: ${kpis.filesToBePaid}    Reports Received: ${kpis.reportsReceived}`,
    ];
    let y = startY;
    kpiLines.forEach(line => { doc.text(line, 8, y); y += 5; });
    y += 2;

    const headers = [
      'Date', 'Expert', 'Type', 'Patient', 'Matter',
      'Att. Pay', 'Expert Pay', 'Report', 'Fee Due',
      'Urgent', 'Planned', 'Partial', 'To Pay Now', 'Comment',
    ];

    const body: any[] = [];
    grouped.forEach(g => {
      body.push([{
        content: `${g.attorney_name}   —   Expert Debts: ${ZAR(g.totalExpertDebts)} · Outstanding: ${ZAR(g.outstanding)} · Planned: ${ZAR(g.plannedTotal)} · Urgent: ${ZAR(g.urgentTotal)}`,
        colSpan: 14,
        styles: { fillColor: [230, 240, 245], textColor: [20, 50, 70], fontStyle: 'bold', fontSize: 7.5 },
      }]);
      g.rows.forEach(r => {
        const p = getPlan(r.appointment_id);
        const toPay = (p.planned || p.urgent) ? Math.max(0, r.fee_due_to_expert - (Number(p.partial) || 0)) : 0;
        const effective =
          p.expertPaymentOverride ??
          (p.urgent ? 'Urgent'
            : p.planned ? 'Planned to pay'
            : r.expert_payment === 'fully paid' ? 'Fully paid'
            : r.expert_payment === 'partially paid' ? 'Partially paid'
            : (Number(p.partial) || 0) > 0 ? 'Partially paid'
            : 'Unpaid');
        body.push([
          format(new Date(r.assessment_date), 'dd MMM yy'),
          r.expert_name, r.expert_type, r.patient_name, r.matter_type,
          r.attorney_payment, effective, r.report_received,
          ZAR(r.fee_due_to_expert),
          p.urgent ? 'YES' : '', p.planned ? 'YES' : '',
          (Number(p.partial) || 0) > 0 ? ZAR(Number(p.partial)) : '',
          toPay > 0 ? ZAR(toPay) : '',
          p.comment || '',
        ]);
      });
      body.push([
        { content: 'Subtotal', colSpan: 8, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: ZAR(g.totalExpertDebts), styles: { halign: 'right', fontStyle: 'bold' } },
        '', '', { content: ZAR(g.partialTotal), styles: { halign: 'right', fontStyle: 'bold' } },
        { content: ZAR(g.plannedTotal), styles: { halign: 'right', fontStyle: 'bold' } },
        '',
      ]);
    });

    body.push([{
      content: `GRAND TOTAL TO BE PAID (selected): ${ZAR(kpis.plannedAmount)}   ·   Urgent: ${ZAR(kpis.urgentAmount)}`,
      colSpan: 14,
      styles: { fillColor: [16, 152, 116], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 9 },
    }]);

    const tableOptions = getStyledTableOptions();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const sideMargin = 6;
    const topMargin = 28; // room for repeated summary header on continuation pages
    const bottomMargin = 22; // room for branded footer

    // Column widths (mm) sized for A4 landscape (~285mm usable)
    const columnStyles: Record<number, any> = {
      0: { cellWidth: 14 },                  // Date
      1: { cellWidth: 28 },                  // Expert
      2: { cellWidth: 20 },                  // Type
      3: { cellWidth: 26 },                  // Patient
      4: { cellWidth: 22 },                  // Matter
      5: { cellWidth: 16, halign: 'center' },// Att. Pay
      6: { cellWidth: 20, halign: 'center' },// Expert Pay
      7: { cellWidth: 18, halign: 'center' },// Report
      8: { cellWidth: 18, halign: 'right'  },// Fee Due
      9: { cellWidth: 12, halign: 'center' },// Urgent
      10:{ cellWidth: 14, halign: 'center' },// Planned
      11:{ cellWidth: 18, halign: 'right'  },// Partial
      12:{ cellWidth: 22, halign: 'right'  },// To Pay Now
      13:{ cellWidth: 'auto' },              // Comment
    };

    autoTable(doc, {
      startY: y,
      head: [headers],
      body,
      ...tableOptions,
      styles: { ...tableOptions.styles, fontSize: 6.5, cellPadding: 1.2, overflow: 'linebreak', valign: 'middle' },
      headStyles: { ...tableOptions.headStyles, fontSize: 7, halign: 'center' },
      columnStyles,
      showHead: 'everyPage',
      rowPageBreak: 'avoid',
      margin: { left: sideMargin, right: sideMargin, top: topMargin, bottom: bottomMargin },
      tableWidth: pageWidth - sideMargin * 2,
      didDrawPage: (data) => {
        if (data.pageNumber === 1) return; // first page already has full branding + KPI lines
        // Repeated summary header on continuation pages so context is never lost.
        // Title strip
        doc.setFillColor(31, 182, 206);
        doc.rect(0, 0, pageWidth, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont(undefined as any, 'bold');
        doc.text('Expert Payment Planner — Payments To Be Made', sideMargin + 2, 6.5);
        doc.setFont(undefined as any, 'normal');
        doc.setFontSize(8);
        doc.text(subtitle, pageWidth - sideMargin - 2, 6.5, { align: 'right' });

        // Summary KPI band (mirrors the sticky on-screen summary bar)
        doc.setFillColor(240, 245, 248);
        doc.rect(0, 10, pageWidth, 14, 'F');
        doc.setTextColor(40, 40, 40);
        doc.setFontSize(7.5);
        doc.text(kpiLines[0], sideMargin + 2, 15.5);
        doc.text(kpiLines[1], sideMargin + 2, 20.5);
        doc.setTextColor(0, 0, 0);
      },
    });

    addBrandingFooter(doc);
    // Page numbers
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - sideMargin - 2, pageHeight - 4, { align: 'right' });
    }
    const filename = `Expert_Payment_Planner_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
    return { doc, filename };
  };

  const handleExportPdf = () => {
    if (!filtered.length) { toast.error('No rows to export'); return; }
    try {
      const { doc, filename } = buildPlannerPdf();
      doc.save(filename);
      toast.success('PDF downloaded');
    } catch (e: any) {
      toast.error('PDF export failed', { description: e?.message || String(e) });
    }
  };

  const handleSendEmail = async () => {
    const toValidation = validateEmailList(emailTo, true);
    const ccValidation = validateEmailList(emailCc, false);
    setEmailToError(toValidation.error);
    setEmailCcError(ccValidation.error);
    if (toValidation.error || ccValidation.error) {
      toast.error(toValidation.error || ccValidation.error || 'Invalid email address');
      return;
    }
    if (!filtered.length) { toast.error('No rows to send'); return; }
    setSending(true);
    try {
      const { doc, filename } = buildPlannerPdf();
      const dataUri = doc.output('datauristring');
      const pdfBase64 = dataUri.split(',')[1] || '';
      const { data, error } = await supabase.functions.invoke('send-payment-planner-email', {
        body: {
          to: emailTo, cc: emailCc || undefined,
          subject: emailSubject, message: emailMessage,
          filename, pdfBase64,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Email failed');
      toast.success('Email sent');
      setEmailOpen(false);
    } catch (e: any) {
      toast.error('Failed to send email', { description: e?.message || String(e) });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 lg:p-6 space-y-4 max-w-[1600px]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Expert Payment Planner</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Plan monthly payments to experts. Grouped per Referring Attorney with per-firm subtotals,
              mirroring the "Payments to be made" spreadsheet.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={loading || !filtered.length}>
              <Download className="h-4 w-4 mr-2" /> Export PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEmailOpen(true)} disabled={loading || !filtered.length}>
              <Mail className="h-4 w-4 mr-2" /> Email PDF
            </Button>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        </div>

        {/* Sticky compact summary bar — always visible so the table never gets pushed out of view */}
        <div className="sticky top-0 z-20 -mx-4 lg:-mx-6 px-4 lg:px-6 py-2 bg-background/95 backdrop-blur border-b">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="font-semibold text-foreground">Summary</span>
            <span><span className="text-muted-foreground">To Pay:</span> <span className="font-semibold tabular-nums text-emerald-600">{ZAR(kpis.plannedAmount)}</span></span>
            <span><span className="text-muted-foreground">Urgent:</span> <span className="font-semibold tabular-nums text-amber-600">{ZAR(kpis.urgentAmount)}</span></span>
            <span><span className="text-muted-foreground">Selected:</span> <span className="font-semibold tabular-nums">{kpis.plannedSelected}</span> <span className="text-muted-foreground">({kpis.urgentSelected} urgent)</span></span>
            <span><span className="text-muted-foreground">Expert Debt:</span> <span className="font-semibold tabular-nums">{ZAR(kpis.totalExpertDebt)}</span></span>
            <span><span className="text-muted-foreground">Outstanding:</span> <span className="font-semibold tabular-nums">{ZAR(kpis.outstanding)}</span></span>
            <span><span className="text-muted-foreground">Files:</span> <span className="font-semibold tabular-nums">{kpis.filesToBePaid}</span></span>
            <span><span className="text-muted-foreground">Reports:</span> <span className="font-semibold tabular-nums">{kpis.reportsReceived}</span></span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 ml-auto text-xs"
              onClick={() => setSummaryExpanded(v => !v)}
            >
              {summaryExpanded ? <><ChevronUp className="h-3.5 w-3.5 mr-1" />Hide cards</> : <><ChevronDown className="h-3.5 w-3.5 mr-1" />Show cards</>}
            </Button>
          </div>
        </div>

        {summaryExpanded && (
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
            <KpiCard label="Total To Be Paid (Selected)" value={ZAR(kpis.plannedAmount)} icon={<DollarSign className="h-4 w-4" />} tone="success" />
            <KpiCard label="Urgent To Pay" value={ZAR(kpis.urgentAmount)} icon={<Flame className="h-4 w-4" />} tone="warning" />
            <KpiCard label={`Selected Files (${kpis.urgentSelected} urgent)`} value={String(kpis.plannedSelected)} icon={<CheckCircle2 className="h-4 w-4" />} />
            <KpiCard label="Payment Planned / To Be Made" value={ZAR(kpis.totalExpertDebt)} icon={<DollarSign className="h-4 w-4" />} />
            <KpiCard label="Attorneys Outstanding" value={ZAR(kpis.outstanding)} icon={<AlertTriangle className="h-4 w-4" />} />
            <KpiCard label="Files to Be Paid" value={String(kpis.filesToBePaid)} icon={<CalendarClock className="h-4 w-4" />} />
            <KpiCard label="Reports Received" value={String(kpis.reportsReceived)} icon={<FileText className="h-4 w-4" />} />
          </div>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              Filters
              {filterOptionsLoading && (
                <span className="inline-flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Loading attorneys & experts…
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <div className="font-medium text-destructive">
                      Failed at: <span className="font-mono">{loadError.step}</span>
                    </div>
                    <div className="text-muted-foreground break-words">{loadError.message}</div>
                    <Button size="sm" variant="outline" className="mt-2" onClick={load} disabled={loading}>
                      {loading ? 'Retrying…' : 'Retry'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="flex gap-2 md:col-span-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search expert, attorney, patient…"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') setSearch(searchInput); }}
                    className="pl-9"
                  />
                </div>
                <Button size="sm" onClick={() => setSearch(searchInput)}><Search className="h-4 w-4 mr-1" />Search</Button>
              </div>
              <VirtualizedMultiSelect
                options={allAttorneys.map(a => ({ id: a.id, label: a.firm_name }))}
                value={attorneyFilter} onChange={setAttorneyFilter}
                placeholderAll="All attorneys" searchPlaceholder="Search attorneys…"
                emptyText="No attorneys found." loading={filterOptionsLoading}
              />
              <VirtualizedMultiSelect
                options={allExperts.map(e => ({ id: e.id, label: e.full_name }))}
                value={expertFilter} onChange={setExpertFilter}
                placeholderAll="All experts" searchPlaceholder="Search experts…"
                emptyText="No experts found." loading={filterOptionsLoading}
              />
              <Select value={professionFilter} onValueChange={setProfessionFilter}>
                <SelectTrigger><SelectValue placeholder="Expert type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All expert types</SelectItem>
                  {allProfessions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={attorneyPayFilter} onValueChange={setAttorneyPayFilter}>
                <SelectTrigger><SelectValue placeholder="Attorney payment" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All attorney payments</SelectItem>
                  <SelectItem value="Fully paid">Fully paid</SelectItem>
                  <SelectItem value="Partially paid">Partially paid</SelectItem>
                  <SelectItem value="Unpaid">Unpaid</SelectItem>
                </SelectContent>
              </Select>
              <Select value={expertPayFilter} onValueChange={setExpertPayFilter}>
                <SelectTrigger><SelectValue placeholder="Expert payment" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All expert payments</SelectItem>
                  <SelectItem value="fully paid">Fully paid</SelectItem>
                  <SelectItem value="partially paid">Partially paid</SelectItem>
                  <SelectItem value="Unpaid">Unpaid</SelectItem>
                </SelectContent>
              </Select>
              <Select value={reportFilter} onValueChange={setReportFilter}>
                <SelectTrigger><SelectValue placeholder="Report received" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All reports</SelectItem>
                  <SelectItem value="yes">Received</SelectItem>
                  <SelectItem value="no">Not received</SelectItem>
                </SelectContent>
              </Select>
              <Select value={paidStatusFilter} onValueChange={setPaidStatusFilter}>
                <SelectTrigger><SelectValue placeholder="Paid / Unpaid" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Paid &amp; Unpaid</SelectItem>
                  <SelectItem value="paid">Paid only</SelectItem>
                  <SelectItem value="unpaid">Unpaid only</SelectItem>
                </SelectContent>
              </Select>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" onClick={load} disabled={loading || filterOptionsLoading}>
                {loading ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
                {loading ? 'Fetching…' : 'Fetch Data'}
              </Button>
              <Button variant="outline" size="sm" onClick={clearFilters} disabled={loading || filterOptionsLoading}>
                <X className="h-4 w-4 mr-1" /> Clear filters & reload
              </Button>
              <div className="ml-auto text-sm text-muted-foreground">
                {filtered.length} row{filtered.length === 1 ? '' : 's'} across {grouped.length} attorney{grouped.length === 1 ? '' : 's'}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Payments Planned / To Be Made</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date of Assessment</TableHead>
                    <TableHead>Expert Name</TableHead>
                    <TableHead>Expert Type</TableHead>
                    <TableHead>Patient Name</TableHead>
                    <TableHead>Type of Matter</TableHead>
                    <TableHead>Referring Attorney</TableHead>
                    <TableHead>Attorneys Payment</TableHead>
                    <TableHead>Expert Payment</TableHead>
                    <TableHead>Report Received</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Fee Due</TableHead>
                    <TableHead className="text-center" title="File from expert to be taken out — urgent">Urgent</TableHead>
                    <TableHead className="text-center">Planned</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Partial Paid</TableHead>
                    <TableHead className="text-right whitespace-nowrap">To Pay Now</TableHead>
                    <TableHead className="w-[220px] min-w-[180px] max-w-[240px]">Comment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={15} className="text-center py-10 text-muted-foreground">Loading…</TableCell></TableRow>
                  ) : grouped.length === 0 ? (
                    <TableRow><TableCell colSpan={15} className="text-center py-10 text-muted-foreground">
                      No appointments match the current filters.
                    </TableCell></TableRow>
                  ) : grouped.map(g => {
                    const allPlanned = g.rows.every(r => getPlan(r.appointment_id).planned || getPlan(r.appointment_id).urgent);
                    const allUrgent = g.rows.every(r => getPlan(r.appointment_id).urgent);
                    return (
                    <React.Fragment key={g.attorney_id}>
                      <TableRow className="bg-muted/60 hover:bg-muted/60">
                        <TableCell colSpan={15} className="font-semibold uppercase text-sm tracking-wide">
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <span>{g.attorney_name}</span>
                            <div className="flex items-center gap-2 normal-case font-normal text-xs">
                              <Button size="sm" variant="outline" className="h-7"
                                onClick={() => setPlan(prev => {
                                  const next = { ...prev };
                                  g.rows.forEach(r => {
                                    next[r.appointment_id] = { ...(next[r.appointment_id] ?? EMPTY_PLAN), planned: !allPlanned };
                                  });
                                  return next;
                                })}>
                                {allPlanned ? 'Unselect all planned' : 'Select all planned'}
                              </Button>
                              <Button size="sm" variant="outline" className="h-7"
                                onClick={() => setPlan(prev => {
                                  const next = { ...prev };
                                  g.rows.forEach(r => {
                                    next[r.appointment_id] = { ...(next[r.appointment_id] ?? EMPTY_PLAN), urgent: !allUrgent };
                                  });
                                  return next;
                                })}>
                                <Flame className="h-3.5 w-3.5 mr-1" /> {allUrgent ? 'Clear urgent' : 'Mark all urgent'}
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                      {g.rows.map(r => {
                        const p = getPlan(r.appointment_id);
                        const toPay = (p.planned || p.urgent)
                          ? Math.max(0, r.fee_due_to_expert - (Number(p.partial) || 0))
                          : 0;
                        return (
                        <TableRow key={r.appointment_id}
                          className={`hover:bg-muted/40 ${p.urgent ? 'bg-rose-50/60' : p.planned ? 'bg-emerald-50/40' : ''}`}>
                          <TableCell className="whitespace-nowrap">{format(new Date(r.assessment_date), 'dd MMM yyyy')}</TableCell>
                          <TableCell className="font-medium min-w-[140px] break-words">{r.expert_name}</TableCell>
                          <TableCell className="min-w-[110px] break-words">{r.expert_type}</TableCell>
                          <TableCell className="min-w-[140px] break-words">{r.patient_name}</TableCell>
                          <TableCell className="min-w-[110px] break-words">{r.matter_type}</TableCell>
                          <TableCell className="min-w-[140px] break-words">{r.attorney_name}</TableCell>
                          <TableCell><Badge variant="outline" className={PAY_STYLE[r.attorney_payment]}>{r.attorney_payment}</Badge></TableCell>
                          <TableCell>
                            {(() => {
                              const effective: ExpertPayStatus =
                                p.expertPaymentOverride ??
                                (p.urgent ? 'Urgent'
                                  : p.planned ? 'Planned to pay'
                                  : r.expert_payment === 'fully paid' ? 'Fully paid'
                                  : r.expert_payment === 'partially paid' ? 'Partially paid'
                                  : (Number(p.partial) || 0) > 0 ? 'Partially paid'
                                  : 'Unpaid');
                              return (
                                <Select
                                  value={effective}
                                  onValueChange={(v) => {
                                    const val = v as ExpertPayStatus;
                                    setPlan(prev => {
                                      const cur = prev[r.appointment_id] ?? EMPTY_PLAN;
                                      return {
                                        ...prev,
                                        [r.appointment_id]: {
                                          ...cur,
                                          expertPaymentOverride: val,
                                          urgent: val === 'Urgent' ? true : (cur.urgent && val !== 'Fully paid'),
                                          planned: val === 'Planned to pay' || val === 'Urgent' ? true : (val === 'Fully paid' ? false : cur.planned),
                                        },
                                      };
                                    });
                                  }}
                                >
                                  <SelectTrigger className={`h-8 w-[148px] text-xs font-medium ${EXPERT_PAY_STYLE[effective]}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {EXPERT_PAY_OPTIONS.map(opt => (
                                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              );
                            })()}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={r.report_received === 'yes'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-50 text-slate-700 border-slate-200'}>
                              {r.report_received}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap font-semibold">{ZAR(r.fee_due_to_expert)}</TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={p.urgent}
                              onCheckedChange={(v) => setPlanField(r.appointment_id, 'urgent', !!v)}
                              aria-label="Urgent — file to be taken out"
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={p.planned}
                              onCheckedChange={(v) => setPlanField(r.appointment_id, 'planned', !!v)}
                              aria-label="Planned payment"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number" min={0} step="0.01"
                              value={p.partial || ''}
                              onChange={(e) => setPlanField(r.appointment_id, 'partial', Number(e.target.value) || 0)}
                              className="h-8 w-28 text-right ml-auto"
                              placeholder="0.00"
                            />
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap font-bold text-emerald-700">
                            {ZAR(toPay)}
                          </TableCell>
                          <TableCell className="align-top w-[220px] max-w-[240px]">
                            <Textarea
                              value={p.comment}
                              onChange={(e) => setPlanField(r.appointment_id, 'comment', e.target.value)}
                              placeholder="Note for this claimant…"
                              className="min-h-[36px] max-h-[96px] overflow-y-auto text-xs leading-snug resize-none break-words whitespace-pre-wrap [overflow-wrap:anywhere]"
                              rows={2}
                            />
                          </TableCell>
                        </TableRow>
                        );
                      })}
                      <TableRow className="bg-background border-b-4 border-background hover:bg-background">
                        <TableCell colSpan={15} className="p-3">
                          <div className="rounded-lg border bg-gradient-to-r from-slate-50 to-emerald-50/40 p-3">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                              {g.attorney_name} — Summary
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                              <SummaryStat label="Total expert debts" value={ZAR(g.totalExpertDebts)} />
                              <SummaryStat label="Attorney total debt" value={ZAR(g.attorneyDebt)} />
                              <SummaryStat label="Deposit by attorney" value={ZAR(g.deposit)} />
                              <SummaryStat label="Outstanding balance" value={ZAR(g.outstanding)} tone="warning" />
                              <SummaryStat
                                label={g.urgentTotal > 0 ? `Planned (incl. ${ZAR(g.urgentTotal)} urgent)` : 'Planned payment'}
                                value={ZAR(g.plannedTotal)}
                                tone="success"
                              />
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" /> Email Expert Payment Planner
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
                The current filtered view ({filtered.length} files across {grouped.length} attorneys)
                will be exported to PDF and sent as an attachment.
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="epp-to">To (comma-separated) *</Label>
                <Input id="epp-to" type="email" value={emailTo}
                  aria-invalid={!!emailToError}
                  aria-describedby={emailToError ? 'epp-to-err' : undefined}
                  className={emailToError ? 'border-destructive focus-visible:ring-destructive' : ''}
                  onChange={(e) => {
                    setEmailTo(e.target.value);
                    if (emailToError) setEmailToError(validateEmailList(e.target.value, true).error);
                  }}
                  onBlur={(e) => setEmailToError(validateEmailList(e.target.value, true).error)}
                  placeholder="finance@example.co.za, manager@example.co.za" />
                {emailToError && (
                  <p id="epp-to-err" className="text-xs text-destructive">{emailToError}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="epp-cc">CC (optional)</Label>
                <Input id="epp-cc" value={emailCc}
                  aria-invalid={!!emailCcError}
                  aria-describedby={emailCcError ? 'epp-cc-err' : undefined}
                  className={emailCcError ? 'border-destructive focus-visible:ring-destructive' : ''}
                  onChange={(e) => {
                    setEmailCc(e.target.value);
                    if (emailCcError) setEmailCcError(validateEmailList(e.target.value, false).error);
                  }}
                  onBlur={(e) => setEmailCcError(validateEmailList(e.target.value, false).error)}
                  placeholder="cc@example.co.za" />
                {emailCcError && (
                  <p id="epp-cc-err" className="text-xs text-destructive">{emailCcError}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="epp-subj">Subject</Label>
                <Input id="epp-subj" value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="epp-msg">Message</Label>
                <Textarea id="epp-msg" rows={4} value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)} />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setEmailOpen(false)} disabled={sending}>Cancel</Button>
              <Button onClick={handleSendEmail} disabled={sending || !emailTo.trim() || !!emailToError || !!emailCcError}>
                {sending ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Sending…</> : <><Mail className="h-4 w-4 mr-2" />Send Email</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

const KpiCard: React.FC<{
  label: string; value: string; icon: React.ReactNode; tone?: 'default' | 'success' | 'warning';
}> = ({ label, value, icon, tone = 'default' }) => {
  const toneClass =
    tone === 'success' ? 'text-emerald-600'
    : tone === 'warning' ? 'text-amber-600'
    : 'text-muted-foreground';
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`flex items-center gap-2 text-xs font-medium ${toneClass}`}>
          {icon}<span className="uppercase tracking-wide">{label}</span>
        </div>
        <div className="mt-2 text-xl font-bold tracking-tight truncate" title={value}>{value}</div>
      </CardContent>
    </Card>
  );
};

const SummaryStat: React.FC<{
  label: string; value: string; tone?: 'default' | 'success' | 'warning';
}> = ({ label, value, tone = 'default' }) => {
  const valueClass =
    tone === 'success' ? 'text-emerald-700'
    : tone === 'warning' ? 'text-amber-700'
    : 'text-foreground';
  return (
    <div className="rounded-md bg-background border px-3 py-2">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground leading-tight">
        {label}
      </div>
      <div className={`mt-1 text-sm font-bold tabular-nums ${valueClass}`} title={value}>
        {value}
      </div>
    </div>
  );
};

export default AdminExpertPaymentPlanner;
