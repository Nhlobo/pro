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
  Columns,
} from 'lucide-react';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addBrandingToPDF, addBrandingFooter, getStyledTableOptions } from '@/utils/pdfBranding';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useConfirm } from '@/hooks/useConfirm';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { Inbox, Send, Lock } from 'lucide-react';

type ExpertPayStatus = 'Urgent' | 'Planned to pay' | 'Partially paid' | 'Fully paid' | 'Unpaid';
type ApprovalStatus = 'pending' | 'approved' | 'not_approved' | 'moved_next';
type RequestStatus = 'none' | 'submitted';
interface CommentEntry {
  id: string;
  author_role: 'employee' | 'admin';
  author_name: string;
  text: string;
  at: string; // ISO timestamp
}
interface PlanState {
  urgent: boolean;
  planned: boolean;
  partial: number;
  comment: string; // legacy single comment (kept for back-compat / history)
  comments?: CommentEntry[];
  expertPaymentOverride?: ExpertPayStatus | null;
  decision?: ApprovalStatus;
  decidedAt?: string | null;
  decidedBy?: string | null;
  requestStatus?: RequestStatus;
  requestedAt?: string | null;
  requestedBy?: string | null;
  requestedById?: string | null;
}
const EMPTY_PLAN: PlanState = { urgent: false, planned: false, partial: 0, comment: '', comments: [], expertPaymentOverride: null, decision: 'pending', decidedAt: null, decidedBy: null, requestStatus: 'none', requestedAt: null, requestedBy: null, requestedById: null };
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
const PLAN_STORAGE_KEY = 'epp_plan_state_v2';
const HISTORY_STORAGE_KEY = 'epp_history_v1';

const fmtStamp = (iso: string) => {
  try { return format(new Date(iso), 'dd MMM yyyy HH:mm'); } catch { return iso; }
};

interface HistorySnapshot {
  id: string;
  label: string;
  created_at: string;
  approvalStatus?: 'pending' | 'approved' | 'not_approved';
  submittedForApprovalAt?: string | null;
  submittedBy?: string | null;
  submittedById?: string | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  approvalNote?: string | null;
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
  const { isAdmin } = usePermissions();
  const { user } = useAuth();
  const admin = isAdmin();
  const currentUserName =
    (user?.user_metadata?.full_name as string) ||
    (user?.user_metadata?.name as string) ||
    user?.email ||
    'Unknown user';
  const authorRole: 'admin' | 'employee' = admin ? 'admin' : 'employee';

  const setDecision = (id: string, decision: ApprovalStatus) =>
    setPlan(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? EMPTY_PLAN),
        decision,
        decidedAt: decision === 'pending' ? null : new Date().toISOString(),
        decidedBy: decision === 'pending' ? null : currentUserName,
        // Once an admin decides, request is consumed
        requestStatus: decision === 'pending' ? (prev[id]?.requestStatus ?? 'none') : 'none',
      },
    }));

  const addComment = (id: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const entry: CommentEntry = {
      id: (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`),
      author_role: authorRole,
      author_name: currentUserName,
      text: trimmed,
      at: new Date().toISOString(),
    };
    setPlan(prev => {
      const cur = prev[id] ?? EMPTY_PLAN;
      return { ...prev, [id]: { ...cur, comments: [...(cur.comments ?? []), entry] } };
    });
  };

  // Notify all admins that a payment-plan item has been submitted for approval.
  const notifyAdminsOfApprovalRequest = async (title: string, message: string, relatedRecordId?: string) => {
    try {
      const { data: admins, error } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');
      if (error) throw error;
      const recipients = (admins || []).map((a: any) => a.user_id).filter(Boolean);
      if (!recipients.length) return;
      const rows = recipients.map((uid: string) => ({
        user_id: uid,
        title,
        message,
        type: 'info',
        category: 'payment',
        related_record_id: relatedRecordId ?? null,
        related_table: 'expert_payment_planner',
        is_read: false,
        email_sent: false,
      }));
      await supabase.from('notifications').insert(rows);
    } catch (e) {
      console.error('Failed to notify admins of approval request:', e);
    }
  };

  // Notify the requesting user via the internal chat (direct conversation).
  // Used when an admin approves/declines a payment plan or row.
  const notifyRequesterViaChat = async (
    requesterUserId: string | null | undefined,
    body: string,
  ) => {
    try {
      if (!user?.id || !requesterUserId || requesterUserId === user.id) return;

      // Try to find an existing direct conversation between the two users.
      const { data: myParts } = await supabase
        .from('internal_chat_participants')
        .select('conversation_id')
        .eq('user_id', user.id);
      const myConvIds = (myParts || []).map((p: any) => p.conversation_id);
      let conversationId: string | null = null;
      if (myConvIds.length) {
        const { data: theirParts } = await supabase
          .from('internal_chat_participants')
          .select('conversation_id')
          .eq('user_id', requesterUserId)
          .in('conversation_id', myConvIds);
        const sharedIds = (theirParts || []).map((p: any) => p.conversation_id);
        if (sharedIds.length) {
          const { data: directConvs } = await supabase
            .from('internal_chat_conversations')
            .select('id')
            .eq('kind', 'direct')
            .in('id', sharedIds)
            .limit(1);
          conversationId = directConvs?.[0]?.id ?? null;
        }
      }
      if (!conversationId) {
        const { data: conv, error: convErr } = await supabase
          .from('internal_chat_conversations')
          .insert({ kind: 'direct', created_by: user.id })
          .select()
          .single();
        if (convErr || !conv) return;
        conversationId = conv.id;
        await supabase.from('internal_chat_participants').insert([
          { conversation_id: conversationId, user_id: user.id, role: 'sender' },
          { conversation_id: conversationId, user_id: requesterUserId, role: 'recipient' },
        ]);
      }
      await supabase.from('internal_chat_messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        body,
        requires_acknowledgement: false,
      });
    } catch (e) {
      console.error('Failed to send chat notification to requester:', e);
    }
  };

  const submitForApproval = (id: string) => {
    const row = rows.find(r => r.appointment_id === id);
    setPlan(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? EMPTY_PLAN),
        requestStatus: 'submitted',
        requestedAt: new Date().toISOString(),
        requestedBy: currentUserName,
        requestedById: user?.id ?? null,
        decision: 'pending',
        decidedAt: null,
        decidedBy: null,
      },
    }));
    void notifyAdminsOfApprovalRequest(
      'Payment plan approval request',
      `${currentUserName} submitted a payment item${row ? ` for ${row.patient_name} (${row.expert_name})` : ''} for approval.`,
      id,
    );
    toast.success('Request submitted to admin for approval');
  };

  // ===== Admin decision prompt (requires a timestamped explanation) =====
  type DecisionTarget =
    | { kind: 'row'; ids: string[] }
    | { kind: 'snapshot'; snapshotId: string };
  interface DecisionPromptState {
    open: boolean;
    decision: Exclude<ApprovalStatus, 'pending'>;
    target: DecisionTarget;
    comment: string;
    error: string | null;
  }
  const [decisionPrompt, setDecisionPrompt] = useState<DecisionPromptState | null>(null);

  const openDecisionPrompt = (decision: Exclude<ApprovalStatus, 'pending'>, target: DecisionTarget) => {
    if (!admin) { toast.error('Only admins can decide'); return; }
    setDecisionPrompt({ open: true, decision, target, comment: '', error: null });
  };

  const confirmDecisionPrompt = async () => {
    if (!decisionPrompt) return;
    const trimmed = decisionPrompt.comment.trim();
    if (trimmed.length < 5) {
      setDecisionPrompt({ ...decisionPrompt, error: 'A short explanation (5+ characters) is required.' });
      return;
    }
    const tag = DECISION_LABEL[decisionPrompt.decision];
    const noteText = `[${tag}] ${trimmed}`;
    if (decisionPrompt.target.kind === 'row') {
      const ids = decisionPrompt.target.ids;
      // Capture requester ids BEFORE setDecision clears requestStatus.
      const requesterByRow = ids.map(id => ({
        id,
        requesterId: plan[id]?.requestedById ?? null,
        row: rows.find(r => r.appointment_id === id),
      }));
      ids.forEach(id => {
        setDecision(id, decisionPrompt.decision);
        addComment(id, noteText);
      });
      // Notify each requester via internal chat.
      requesterByRow.forEach(({ requesterId, row }) => {
        if (!requesterId) return;
        const label = row ? `${row.patient_name} (${row.expert_name})` : 'payment item';
        const verb = decisionPrompt.decision === 'approved' ? 'approved' : 'declined';
        void notifyRequesterViaChat(
          requesterId,
          `✅ Your payment plan request for ${label} was ${verb} by ${currentUserName}.\n\nNote: ${trimmed}`,
        );
      });
      toast.success(`${tag} — ${ids.length} row${ids.length === 1 ? '' : 's'} updated`);
    } else {
      const id = decisionPrompt.target.snapshotId;
      if (decisionPrompt.decision === 'approved') {
        await approveSnapshot(id, noteText);
      } else if (decisionPrompt.decision === 'not_approved') {
        await declineSnapshot(id, noteText);
      }
    }
    setDecisionPrompt(null);
  };


  const [history, setHistory] = useState<HistorySnapshot[]>(() => {
    try {
      const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history)); } catch {}
  }, [history]);

  // ----- DB persistence + realtime sync for snapshots -----
  // Snapshots are mirrored to public.expert_payment_planner_snapshots so the
  // Admin Expert Payment Planner receives approval requests across users in
  // realtime (not just from the submitter's own browser localStorage).
  const dbRowToSnapshot = (r: any): HistorySnapshot => ({
    id: r.id,
    label: r.label,
    created_at: r.created_at,
    approvalStatus: (r.approval_status ?? 'pending') as HistorySnapshot['approvalStatus'],
    submittedForApprovalAt: r.submitted_for_approval_at,
    submittedBy: r.submitted_by,
    submittedById: r.submitted_by_id,
    approvedAt: r.approved_at,
    approvedBy: r.approved_by,
    approvalNote: r.approval_note,
    filters: r.filters ?? { dateFrom: '', dateTo: '', search: '', attorneyPay: 'all', expertPay: 'all', profession: 'all', report: 'all', paidStatus: 'all', decision: 'all' },
    totals: r.totals ?? { rows: 0, attorneys: 0, plannedAmount: 0, urgentAmount: 0, approvedAmount: 0, approvedCount: 0, notApprovedCount: 0, movedNextCount: 0, pendingCount: 0 },
    entries: r.entries ?? [],
  });
  const snapshotToDbRow = (s: HistorySnapshot) => ({
    id: s.id,
    label: s.label,
    approval_status: s.approvalStatus ?? 'pending',
    submitted_for_approval_at: s.submittedForApprovalAt ?? null,
    submitted_by: s.submittedBy ?? null,
    submitted_by_id: s.submittedById ?? null,
    approved_at: s.approvedAt ?? null,
    approved_by: s.approvedBy ?? null,
    approval_note: s.approvalNote ?? null,
    filters: s.filters as any,
    totals: s.totals as any,
    entries: s.entries as any,
    created_at: s.created_at,
  });
  const mergeSnapshot = (snap: HistorySnapshot) => {
    setHistory(prev => {
      const idx = prev.findIndex(h => h.id === snap.id);
      if (idx === -1) return [snap, ...prev].slice(0, 100);
      const next = [...prev]; next[idx] = snap; return next;
    });
  };
  const persistSnapshot = async (snap: HistorySnapshot) => {
    try {
      const { error } = await (supabase as any)
        .from('expert_payment_planner_snapshots')
        .upsert(snapshotToDbRow(snap), { onConflict: 'id' });
      if (error) throw error;
    } catch (e) {
      console.error('persistSnapshot failed:', e);
    }
  };
  const removeSnapshotFromDb = async (id: string) => {
    try {
      await (supabase as any).from('expert_payment_planner_snapshots').delete().eq('id', id);
    } catch (e) {
      console.error('removeSnapshotFromDb failed:', e);
    }
  };

  // Initial load from DB + realtime subscription
  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await (supabase as any)
        .from('expert_payment_planner_snapshots')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (!active || error || !data) return;
      const dbSnaps: HistorySnapshot[] = data.map(dbRowToSnapshot);
      setHistory(prev => {
        const byId = new Map<string, HistorySnapshot>();
        dbSnaps.forEach(s => byId.set(s.id, s));
        prev.forEach(s => { if (!byId.has(s.id)) byId.set(s.id, s); });
        return Array.from(byId.values()).sort((a, b) =>
          (b.created_at || '').localeCompare(a.created_at || ''),
        );
      });
    })();

    const channel = supabase
      .channel('epp-snapshots-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expert_payment_planner_snapshots' }, (payload: any) => {
        if (payload.eventType === 'DELETE') {
          const oldId = payload.old?.id;
          if (oldId) setHistory(prev => prev.filter(h => h.id !== oldId));
          return;
        }
        const row = payload.new;
        if (!row) return;
        mergeSnapshot(dbRowToSnapshot(row));
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);


  // Auto-archive a per-month snapshot whenever planned/urgent rows exist.
  // Keeps "Month YYYY" entries in History updated so users can revisit and request approval.
  useEffect(() => {
    if (loading || !rows.length) return;
    const selected = rows.filter(r => {
      const p = plan[r.appointment_id];
      return p && (p.planned || p.urgent);
    });
    if (!selected.length) return;
    const monthLabel = `Auto · ${format(new Date(), 'MMMM yyyy')}`;
    const monthKey = format(new Date(), 'yyyy-MM');
    const nowIso = new Date().toISOString();
    const entries = selected.map(r => {
      const p = plan[r.appointment_id] ?? EMPTY_PLAN;
      const toPay = (p.planned || p.urgent) ? Math.max(0, r.fee_due_to_expert - (Number(p.partial) || 0)) : 0;
      return {
        appointment_id: r.appointment_id,
        attorney_name: r.attorney_name,
        expert_name: r.expert_name,
        patient_name: r.patient_name,
        assessment_date: r.assessment_date,
        fee_due: r.fee_due_to_expert,
        partial: Number(p.partial) || 0,
        to_pay: toPay,
        urgent: !!p.urgent,
        planned: !!p.planned,
        decision: (p.decision ?? 'pending') as ApprovalStatus,
        comment: p.comment || '',
      };
    });
    const handle = setTimeout(() => {
      setHistory(prev => {
        const existingIdx = prev.findIndex(h => h.id === `auto_${monthKey}`);
        const plannedAmount = entries.reduce((s, e) => s + e.to_pay, 0);
        const urgentAmount = entries.filter(e => e.urgent).reduce((s, e) => s + e.to_pay, 0);
        const snap: HistorySnapshot = {
          id: `auto_${monthKey}`,
          label: monthLabel,
          created_at: existingIdx >= 0 ? prev[existingIdx].created_at : nowIso,
          approvalStatus: existingIdx >= 0 ? prev[existingIdx].approvalStatus : 'pending',
          submittedForApprovalAt: existingIdx >= 0 ? prev[existingIdx].submittedForApprovalAt : null,
          submittedBy: existingIdx >= 0 ? prev[existingIdx].submittedBy : null,
          submittedById: existingIdx >= 0 ? prev[existingIdx].submittedById : null,
          approvedAt: existingIdx >= 0 ? prev[existingIdx].approvedAt : null,
          approvedBy: existingIdx >= 0 ? prev[existingIdx].approvedBy : null,
          approvalNote: existingIdx >= 0 ? prev[existingIdx].approvalNote : null,
          filters: { dateFrom: '', dateTo: '', search: '', attorneyPay: 'all', expertPay: 'all', profession: 'all', report: 'all', paidStatus: 'all', decision: 'all' },
          totals: {
            rows: entries.length,
            attorneys: new Set(entries.map(e => e.attorney_name)).size,
            plannedAmount, urgentAmount,
            approvedAmount: 0, approvedCount: entries.filter(e => e.decision === 'approved').length,
            notApprovedCount: entries.filter(e => e.decision === 'not_approved').length,
            movedNextCount: entries.filter(e => e.decision === 'moved_next').length,
            pendingCount: entries.filter(e => (e.decision ?? 'pending') === 'pending').length,
          },
          entries,
        };
        if (existingIdx >= 0) {
          const next = [...prev]; next[existingIdx] = snap; return next;
        }
        return [snap, ...prev].slice(0, 50);
      });
    }, 1500);
    return () => clearTimeout(handle);
  }, [plan, rows, loading]);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyDetail, setHistoryDetail] = useState<HistorySnapshot | null>(null);
  const [approvalsOpen, setApprovalsOpen] = useState(false);
  const [approvalsTab, setApprovalsTab] = useState<'pending' | 'history'>('pending');
  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [reviewExportOpen, setReviewExportOpen] = useState(false);
  const [reviewExportFrom, setReviewExportFrom] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [reviewExportTo, setReviewExportTo] = useState<string>(() => new Date().toISOString().slice(0, 10));

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

  // Refresh when an expert profile/fee is updated elsewhere
  useEffect(() => {
    const handler = () => { loadFilterOptions(); load(); };
    window.addEventListener('medical-expert-updated', handler);
    return () => window.removeEventListener('medical-expert-updated', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (professionFilter !== 'all' && r.expert_type !== professionFilter) return false;
      if (attorneyPayFilter !== 'all' && r.attorney_payment !== attorneyPayFilter) return false;
      if (expertPayFilter !== 'all' && r.expert_payment !== expertPayFilter) return false;
      if (reportFilter !== 'all' && r.report_received !== reportFilter) return false;
      if (paidStatusFilter === 'paid' && r.expert_payment !== 'fully paid') return false;
      if (paidStatusFilter === 'unpaid' && r.expert_payment === 'fully paid') return false;
      if (decisionFilter !== 'all') {
        const d = (plan[r.appointment_id]?.decision ?? 'pending');
        if (d !== decisionFilter) return false;
      }
      if (q) {
        const hay = [r.expert_name, r.attorney_name, r.patient_name, r.expert_type, r.matter_type]
          .join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, professionFilter, attorneyPayFilter, expertPayFilter, reportFilter, paidStatusFilter, decisionFilter, plan]);

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
    let approvedCount = 0, notApprovedCount = 0, movedNextCount = 0, pendingCount = 0;
    let approvedAmount = 0;
    filtered.forEach(r => {
      const p = getPlan(r.appointment_id);
      const d = p.decision ?? 'pending';
      const owed = Math.max(0, r.fee_due_to_expert - (Number(p.partial) || 0));
      if (d === 'approved') { approvedCount++; approvedAmount += owed; }
      else if (d === 'not_approved') notApprovedCount++;
      else if (d === 'moved_next') movedNextCount++;
      else pendingCount++;
    });
    return { totalExpertDebt, totalAttorneyDebt, totalDeposits, outstanding, reportsReceived, filesToBePaid, totalRows: filtered.length, plannedSelected, urgentSelected, plannedAmount, urgentAmount, approvedCount, notApprovedCount, movedNextCount, pendingCount, approvedAmount };
  }, [filtered, plan]);

  const clearFilters = () => {
    setSearch(''); setSearchInput(''); setAttorneyFilter([]); setExpertFilter([]);
    setProfessionFilter('all'); setAttorneyPayFilter('all'); setExpertPayFilter('all');
    setReportFilter('all'); setPaidStatusFilter('all'); setDecisionFilter('all');
    setDateFrom(''); setDateTo('');
    load();
  };

  const saveSnapshot = () => {
    if (!filtered.length) { toast.error('Nothing to snapshot'); return; }
    const label = (snapshotLabel || `Planner ${format(new Date(), 'dd MMM yyyy HH:mm')}`).trim();
    const nowIso = new Date().toISOString();
    const snap: HistorySnapshot = {
      id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      label,
      created_at: nowIso,
      approvalStatus: 'pending',
      submittedForApprovalAt: nowIso,
      submittedBy: currentUserName,
      submittedById: user?.id ?? null,
      approvedAt: null,
      approvedBy: null,
      approvalNote: null,
      filters: {
        dateFrom, dateTo, search,
        attorneyPay: attorneyPayFilter, expertPay: expertPayFilter, profession: professionFilter,
        report: reportFilter, paidStatus: paidStatusFilter, decision: decisionFilter,
      },
      totals: {
        rows: kpis.totalRows, attorneys: grouped.length,
        plannedAmount: kpis.plannedAmount, urgentAmount: kpis.urgentAmount,
        approvedAmount: kpis.approvedAmount, approvedCount: kpis.approvedCount,
        notApprovedCount: kpis.notApprovedCount, movedNextCount: kpis.movedNextCount,
        pendingCount: kpis.pendingCount,
      },
      entries: filtered.map(r => {
        const p = getPlan(r.appointment_id);
        const toPay = (p.planned || p.urgent) ? Math.max(0, r.fee_due_to_expert - (Number(p.partial) || 0)) : 0;
        return {
          appointment_id: r.appointment_id,
          attorney_name: r.attorney_name,
          expert_name: r.expert_name,
          patient_name: r.patient_name,
          assessment_date: r.assessment_date,
          fee_due: r.fee_due_to_expert,
          partial: Number(p.partial) || 0,
          to_pay: toPay,
          urgent: !!p.urgent,
          planned: !!p.planned,
          decision: p.decision ?? 'pending',
          comment: p.comment || '',
        };
      }),
    };
    setHistory(prev => [snap, ...prev].slice(0, 50));

    // Also push selected (planned/urgent) rows into the Approval Requests inbox
    // so an admin can act on them individually.
    setPlan(prev => {
      const next = { ...prev };
      filtered.forEach(r => {
        const cur = next[r.appointment_id] ?? EMPTY_PLAN;
        if (!cur.planned && !cur.urgent) return;
        if ((cur.decision ?? 'pending') !== 'pending') return;
        next[r.appointment_id] = {
          ...cur,
          requestStatus: 'submitted',
          requestedAt: nowIso,
          requestedBy: currentUserName,
          requestedById: user?.id ?? null,
          decision: 'pending',
          decidedAt: null,
          decidedBy: null,
        };
      });
      return next;
    });

    setSnapshotLabel('');
    const selectedCount = filtered.filter(r => {
      const p = getPlan(r.appointment_id);
      return (p.planned || p.urgent) && (p.decision ?? 'pending') === 'pending';
    }).length;
    void notifyAdminsOfApprovalRequest(
      'Payment plan submitted for approval',
      `${currentUserName} saved "${label}" and sent ${selectedCount} payment item${selectedCount === 1 ? '' : 's'} for approval.`,
      snap.id,
    );
    toast.success('Plan saved & sent for approval', {
      description: 'Snapshot stored in History and selected rows queued in Approval Requests.',
    });
  };

  const sendSnapshotForApproval = (id: string) => {
    const nowIso = new Date().toISOString();
    setHistory(prev => prev.map(h => h.id === id ? {
      ...h,
      approvalStatus: h.approvalStatus === 'approved' ? 'approved' : 'pending',
      submittedForApprovalAt: nowIso,
      submittedBy: currentUserName,
      submittedById: user?.id ?? null,
    } : h));
    // Re-push the snapshot's entries into the live Approval Requests inbox.
    setPlan(prev => {
      const next = { ...prev };
      const snap = history.find(h => h.id === id);
      if (!snap) return prev;
      snap.entries.forEach(e => {
        if (!e.planned && !e.urgent) return;
        const cur = next[e.appointment_id] ?? EMPTY_PLAN;
        if ((cur.decision ?? 'pending') !== 'pending') return;
        next[e.appointment_id] = {
          ...cur,
          requestStatus: 'submitted',
          requestedAt: nowIso,
          requestedBy: currentUserName,
          requestedById: user?.id ?? null,
        };
      });
      return next;
    });
    const snap = history.find(h => h.id === id);
    void notifyAdminsOfApprovalRequest(
      'Payment plan re-sent for approval',
      `${currentUserName} re-sent "${snap?.label ?? 'a payment plan'}" for approval.`,
      id,
    );
    toast.success('Re-sent for approval');
  };

  const approveSnapshot = async (id: string, note?: string) => {
    if (!admin) { toast.error('Only admins can approve'); return; }
    if (!note) {
      openDecisionPrompt('approved', { kind: 'snapshot', snapshotId: id });
      return;
    }
    const nowIso = new Date().toISOString();
    setHistory(prev => prev.map(h => h.id === id ? {
      ...h,
      approvalStatus: 'approved',
      approvedAt: nowIso,
      approvedBy: currentUserName,
      approvalNote: `${fmtStamp(nowIso)} — ${currentUserName}: ${note}`,
    } : h));
    // Also record on the live rows belonging to this snapshot so the audit
    // shows up in each row's comment thread.
    const snap = history.find(h => h.id === id);
    snap?.entries.forEach(e => addComment(e.appointment_id, note));
    // Notify the user who submitted the plan via the internal chat.
    if (snap?.submittedById) {
      void notifyRequesterViaChat(
        snap.submittedById,
        `✅ Your payment plan "${snap.label}" was approved by ${currentUserName}.\n\nNote: ${note}\n\nYou can now email and export this plan.`,
      );
    }
    toast.success('Plan approved — email & export unlocked');
  };

  const declineSnapshot = async (id: string, note?: string) => {
    if (!admin) { toast.error('Only admins can decline'); return; }
    if (!note) {
      openDecisionPrompt('not_approved', { kind: 'snapshot', snapshotId: id });
      return;
    }
    const nowIso = new Date().toISOString();
    setHistory(prev => prev.map(h => h.id === id ? {
      ...h,
      approvalStatus: 'not_approved',
      approvedAt: nowIso,
      approvedBy: currentUserName,
      approvalNote: `${fmtStamp(nowIso)} — ${currentUserName}: ${note}`,
    } : h));
    const snap = history.find(h => h.id === id);
    snap?.entries.forEach(e => addComment(e.appointment_id, note));
    if (snap?.submittedById) {
      void notifyRequesterViaChat(
        snap.submittedById,
        `⚠️ Your payment plan "${snap.label}" was declined by ${currentUserName}.\n\nNote: ${note}\n\nPlease amend the schedule and re-submit for approval.`,
      );
    }
    toast.success('Plan declined');
  };


  const deleteSnapshot = (id: string) => {
    setHistory(prev => prev.filter(h => h.id !== id));
    if (historyDetail?.id === id) setHistoryDetail(null);
  };
  const confirm = useConfirm();
  const restoreSnapshot = async (snap: HistorySnapshot) => {
    const ok = await confirm({
      title: 'Restore decisions from snapshot?',
      description: `This will overwrite the current Urgent, Planned, Partial, Comment and Approval fields for ${snap.entries.length} claimant${snap.entries.length === 1 ? '' : 's'} with the values saved in "${snap.label}" on ${format(new Date(snap.created_at), 'dd MMM yyyy HH:mm')}. Existing edits for those claimants cannot be recovered.`,
      confirmText: 'Restore decisions',
      cancelText: 'Cancel',
    });
    if (!ok) return;
    setPlan(prev => {
      const next = { ...prev };
      snap.entries.forEach(e => {
        next[e.appointment_id] = {
          ...(next[e.appointment_id] ?? EMPTY_PLAN),
          partial: e.partial,
          urgent: e.urgent,
          planned: e.planned,
          decision: e.decision,
          comment: e.comment,
        };
      });
      return next;
    });
    toast.success(`Restored "${snap.label}"`, {
      description: `${snap.entries.length} claimant${snap.entries.length === 1 ? '' : 's'} updated from snapshot.`,
    });
    setHistoryDetail(null);
    setHistoryOpen(false);
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
  const [compareMode, setCompareMode] = useState(false);
  type ExportSort = 'default' | 'decision';
  const [exportSort, setExportSort] = useState<ExportSort>('default');
  const DECISION_ORDER: Record<ApprovalStatus, number> = { approved: 0, not_approved: 1, moved_next: 2, pending: 3 };

  // ===== Snapshot Email / Export =====
  const [snapEmailOpen, setSnapEmailOpen] = useState(false);
  const [snapEmailTarget, setSnapEmailTarget] = useState<HistorySnapshot | null>(null);
  const [snapEmailTo, setSnapEmailTo] = useState('');
  const [snapEmailCc, setSnapEmailCc] = useState('');
  const [snapEmailToError, setSnapEmailToError] = useState<string | null>(null);
  const [snapEmailCcError, setSnapEmailCcError] = useState<string | null>(null);
  const [snapEmailSubject, setSnapEmailSubject] = useState('Approved Expert Payment Plan');
  const [snapEmailMessage, setSnapEmailMessage] = useState(
    'Please find attached the approved Expert Payment Plan.'
  );

  const buildSnapshotPdf = (snap: HistorySnapshot): { doc: jsPDF; filename: string } => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const subtitle = `${snap.label} · ${snap.totals.rows} files · ${snap.totals.attorneys} attorneys · ${snap.approvalStatus === 'approved' ? 'APPROVED' : (snap.approvalStatus || 'pending').toUpperCase()}`;
    const startY = addBrandingToPDF(doc, 'Expert Payment Plan — Approved Document', subtitle);
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    const kpiLine = `Planned: ${ZAR(snap.totals.plannedAmount)}    Urgent: ${ZAR(snap.totals.urgentAmount)}    Approved: ${ZAR(snap.totals.approvedAmount)} (${snap.totals.approvedCount})    Not appr: ${snap.totals.notApprovedCount}    Next: ${snap.totals.movedNextCount}    Pending: ${snap.totals.pendingCount}`;
    doc.text(kpiLine, 8, startY);
    const meta = `Submitted by ${snap.submittedBy || '—'} on ${snap.submittedForApprovalAt ? fmtStamp(snap.submittedForApprovalAt) : '—'}${snap.approvedBy ? `    ·    ${snap.approvalStatus === 'approved' ? 'Approved' : 'Decided'} by ${snap.approvedBy} on ${snap.approvedAt ? fmtStamp(snap.approvedAt) : '—'}` : ''}`;
    doc.setFontSize(8);
    doc.text(meta, 8, startY + 5);

    const headers = ['Date', 'Attorney', 'Claimant', 'Expert', 'Fee Due', 'Partial', 'To Pay', 'Urgent', 'Planned', 'Decision', 'Comment'];
    const body = snap.entries.map(e => [
      format(new Date(e.assessment_date), 'dd MMM yy'),
      e.attorney_name, e.patient_name, e.expert_name,
      ZAR(e.fee_due),
      e.partial > 0 ? ZAR(e.partial) : '',
      e.to_pay > 0 ? ZAR(e.to_pay) : '',
      e.urgent ? 'YES' : '', e.planned ? 'YES' : '',
      DECISION_LABEL[e.decision], e.comment || '',
    ]);
    body.push([
      { content: `GRAND TOTAL: ${ZAR(snap.totals.plannedAmount)}`, colSpan: 11, styles: { halign: 'center', fillColor: [16, 152, 116], textColor: 255, fontStyle: 'bold' } } as any
    ]);
    autoTable(doc, {
      startY: startY + 10,
      head: [headers],
      body,
      ...getStyledTableOptions(),
      styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
      headStyles: { fontSize: 7.5, halign: 'center', fillColor: [31, 182, 206], textColor: 255 },
      margin: { left: 6, right: 6, top: 14, bottom: 16 },
    });
    addBrandingFooter(doc);
    const filename = `Expert_Payment_Plan_${snap.label.replace(/[^a-z0-9]+/gi, '_')}_${format(new Date(snap.created_at), 'yyyyMMdd_HHmm')}.pdf`;
    return { doc, filename };
  };

  // Build & download a PDF of the Review History (events with timestamps + authors) for a date range.
  const exportReviewHistoryPdf = () => {
    if (!reviewExportFrom || !reviewExportTo) { toast.error('Pick a from and to date'); return; }
    const fromMs = new Date(reviewExportFrom + 'T00:00:00').getTime();
    const toMs = new Date(reviewExportTo + 'T23:59:59').getTime();
    if (isNaN(fromMs) || isNaN(toMs) || fromMs > toMs) { toast.error('Invalid date range'); return; }

    type Evt = { at: string; role: string; author: string; type: string; detail: string; ctx: string };
    const events: Evt[] = [];
    for (const r of rows) {
      const p = getPlan(r.appointment_id);
      const ctx = `${r.patient_name} · ${r.expert_name} · ${r.attorney_name}`;
      if (p.requestedAt) {
        const t = new Date(p.requestedAt).getTime();
        if (t >= fromMs && t <= toMs) {
          events.push({ at: p.requestedAt, role: 'Employee', author: p.requestedBy || '—', type: 'Request submitted', detail: '', ctx });
        }
      }
      if (p.decidedAt && p.decision && p.decision !== 'pending') {
        const t = new Date(p.decidedAt).getTime();
        if (t >= fromMs && t <= toMs) {
          events.push({ at: p.decidedAt, role: 'Admin', author: p.decidedBy || '—', type: DECISION_LABEL[p.decision], detail: '', ctx });
        }
      }
      for (const c of (p.comments ?? [])) {
        const t = new Date(c.at).getTime();
        if (t >= fromMs && t <= toMs) {
          events.push({ at: c.at, role: c.author_role === 'admin' ? 'Admin' : 'Employee', author: c.author_name || '—', type: 'Comment', detail: c.text || '', ctx });
        }
      }
    }
    events.sort((a, b) => a.at.localeCompare(b.at));

    if (!events.length) { toast.error('No review history in this date range'); return; }

    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const subtitle = `Review history · ${format(new Date(reviewExportFrom), 'dd MMM yyyy')} → ${format(new Date(reviewExportTo), 'dd MMM yyyy')} · ${events.length} events`;
      const startY = addBrandingToPDF(doc, 'Expert Payment Planner — Review History', subtitle);
      autoTable(doc, {
        startY: startY + 4,
        head: [['Timestamp', 'Role', 'Author', 'Event', 'Claimant · Expert · Attorney', 'Comment / Detail']],
        body: events.map(e => [fmtStamp(e.at), e.role, e.author, e.type, e.ctx, e.detail]),
        ...getStyledTableOptions(),
        styles: { fontSize: 8, cellPadding: 1.8, overflow: 'linebreak' },
        headStyles: { fontSize: 8.5, halign: 'center', fillColor: [31, 182, 206], textColor: 255 },
        columnStyles: {
          0: { cellWidth: 32 }, 1: { cellWidth: 18 }, 2: { cellWidth: 32 },
          3: { cellWidth: 34 }, 4: { cellWidth: 75 }, 5: { cellWidth: 'auto' },
        },
        margin: { left: 6, right: 6, top: 14, bottom: 16 },
      });
      addBrandingFooter(doc);
      const filename = `Expert_Payment_Review_History_${reviewExportFrom}_to_${reviewExportTo}.pdf`;
      doc.save(filename);
      toast.success(`Exported ${events.length} review events`);
      setReviewExportOpen(false);
    } catch (e: any) {
      toast.error('Export failed', { description: e?.message || String(e) });
    }
  };

  const exportSnapshotPdf = (snap: HistorySnapshot) => {
    if (snap.approvalStatus !== 'approved') { toast.error('Plan must be approved before export'); return; }
    try {
      const { doc, filename } = buildSnapshotPdf(snap);
      doc.save(filename);
      toast.success('Approved plan exported');
    } catch (e: any) {
      toast.error('Export failed', { description: e?.message || String(e) });
    }
  };

  const openEmailSnapshot = (snap: HistorySnapshot) => {
    if (snap.approvalStatus !== 'approved') { toast.error('Plan must be approved before emailing'); return; }
    setSnapEmailTarget(snap);
    setSnapEmailTo(''); setSnapEmailCc('');
    setSnapEmailToError(null); setSnapEmailCcError(null);
    setSnapEmailSubject(`Approved Expert Payment Plan — ${snap.label}`);
    setSnapEmailMessage('Please find attached the approved Expert Payment Plan.');
    setSnapEmailOpen(true);
  };

  const sendSnapshotEmail = async () => {
    if (!snapEmailTarget) return;
    const toV = validateEmailList(snapEmailTo, true);
    const ccV = validateEmailList(snapEmailCc, false);
    setSnapEmailToError(toV.error); setSnapEmailCcError(ccV.error);
    if (toV.error || ccV.error) { toast.error(toV.error || ccV.error || 'Invalid email'); return; }
    setSending(true);
    try {
      const { doc, filename } = buildSnapshotPdf(snapEmailTarget);
      const dataUri = doc.output('datauristring');
      const pdfBase64 = dataUri.split(',')[1] || '';
      const { data, error } = await supabase.functions.invoke('send-payment-planner-email', {
        body: {
          to: snapEmailTo, cc: snapEmailCc || undefined,
          subject: snapEmailSubject, message: snapEmailMessage,
          filename, pdfBase64,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Email failed');
      toast.success('Approved plan emailed');
      setSnapEmailOpen(false);
    } catch (e: any) {
      toast.error('Failed to send', { description: e?.message || String(e) });
    } finally { setSending(false); }
  };

  // Plans created today (for the "Today" quick-access strip in History dialog)
  const todaysPlans = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    return history.filter(h => (h.created_at || '').slice(0, 10) === todayKey);
  }, [history]);


  const buildPlannerPdf = (opts?: { sortByDecision?: boolean }): { doc: jsPDF; filename: string } => {
    const sortByDecision = !!opts?.sortByDecision;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const subtitle = `${grouped.length} attorney${grouped.length === 1 ? '' : 's'} · ${filtered.length} file${filtered.length === 1 ? '' : 's'}${sortByDecision ? ' · sorted by approval decision' : ''}`;
    const startY = addBrandingToPDF(doc, 'Expert Payment Planner — Payments To Be Made', subtitle);

    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    const kpiLines = [
      `Total To Be Paid (Selected): ${ZAR(kpis.plannedAmount)}    Urgent To Pay: ${ZAR(kpis.urgentAmount)}    Selected Files: ${kpis.plannedSelected} (${kpis.urgentSelected} urgent)`,
      `Total Expert Debt: ${ZAR(kpis.totalExpertDebt)}    Attorneys Outstanding: ${ZAR(kpis.outstanding)}    Files To Be Paid: ${kpis.filesToBePaid}    Reports Received: ${kpis.reportsReceived}    Approved: ${ZAR(kpis.approvedAmount)} (${kpis.approvedCount})    Not Appr: ${kpis.notApprovedCount}    Next: ${kpis.movedNextCount}    Pending: ${kpis.pendingCount}`,
    ];
    let y = startY;
    kpiLines.forEach(line => { doc.text(line, 8, y); y += 5; });
    y += 1;

    // Approval legend (mirrors row colour coding)
    const legend: Array<{ label: string; fill: [number, number, number]; text: [number, number, number] }> = [
      { label: 'Approved', fill: [220, 252, 231], text: [22, 101, 52] },
      { label: 'Not approved', fill: [254, 226, 226], text: [153, 27, 27] },
      { label: 'Move to next', fill: [224, 231, 255], text: [55, 48, 163] },
      { label: 'Pending', fill: [241, 245, 249], text: [71, 85, 105] },
    ];
    const drawLegend = (top: number) => {
      doc.setFontSize(7);
      doc.setFont(undefined as any, 'bold');
      doc.setTextColor(60, 60, 60);
      doc.text('Approval status:', 8, top + 3.2);
      let lx = 8 + doc.getTextWidth('Approval status:') + 2;
      legend.forEach(item => {
        const w = doc.getTextWidth(item.label) + 4;
        doc.setFillColor(item.fill[0], item.fill[1], item.fill[2]);
        doc.rect(lx, top, w, 4.6, 'F');
        doc.setTextColor(item.text[0], item.text[1], item.text[2]);
        doc.text(item.label, lx + 2, top + 3.2);
        lx += w + 2;
      });
      doc.setFont(undefined as any, 'normal');
      doc.setTextColor(0, 0, 0);
    };
    drawLegend(y);
    y += 7;

    const headers = [
      'Date', 'Expert', 'Type', 'Patient', 'Matter',
      'Att. Pay', 'Expert Pay', 'Report', 'Fee Due',
      'Urgent', 'Planned', 'Partial', 'To Pay Now', 'Approval', 'Comment',
    ];

    const body: any[] = [];
    grouped.forEach(g => {
      body.push([{
        content: `${g.attorney_name}   —   Expert Debts: ${ZAR(g.totalExpertDebts)} · Outstanding: ${ZAR(g.outstanding)} · Planned: ${ZAR(g.plannedTotal)} · Urgent: ${ZAR(g.urgentTotal)}`,
        colSpan: 15,
        styles: { fillColor: [230, 240, 245], textColor: [20, 50, 70], fontStyle: 'bold', fontSize: 7.5 },
      }]);
      const groupRows = sortByDecision
        ? [...g.rows].sort((a, b) => {
            const da = (getPlan(a.appointment_id).decision ?? 'pending') as ApprovalStatus;
            const db = (getPlan(b.appointment_id).decision ?? 'pending') as ApprovalStatus;
            return DECISION_ORDER[da] - DECISION_ORDER[db];
          })
        : g.rows;
      groupRows.forEach(r => {
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
        const decision = (p.decision ?? 'pending') as ApprovalStatus;
        const decisionLabel = decision === 'pending'
          ? 'Pending'
          : `${DECISION_LABEL[decision]}${p.decidedAt ? `\n${format(new Date(p.decidedAt), 'dd MMM yy HH:mm')}` : ''}`;
        const decisionFill =
          decision === 'approved' ? [220, 252, 231]
          : decision === 'not_approved' ? [254, 226, 226]
          : decision === 'moved_next' ? [224, 231, 255]
          : [241, 245, 249];
        const decisionText =
          decision === 'approved' ? [22, 101, 52]
          : decision === 'not_approved' ? [153, 27, 27]
          : decision === 'moved_next' ? [55, 48, 163]
          : [71, 85, 105];
        body.push([
          format(new Date(r.assessment_date), 'dd MMM yy'),
          r.expert_name, r.expert_type, r.patient_name, r.matter_type,
          r.attorney_payment, effective, r.report_received,
          ZAR(r.fee_due_to_expert),
          p.urgent ? 'YES' : '', p.planned ? 'YES' : '',
          (Number(p.partial) || 0) > 0 ? ZAR(Number(p.partial)) : '',
          toPay > 0 ? ZAR(toPay) : '',
          { content: decisionLabel, styles: { fillColor: decisionFill, textColor: decisionText, fontStyle: 'bold', fontSize: 6, halign: 'center' } },
          p.comment || '',
        ]);
      });
      body.push([
        { content: 'Subtotal', colSpan: 8, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: ZAR(g.totalExpertDebts), styles: { halign: 'right', fontStyle: 'bold' } },
        '', '', { content: ZAR(g.partialTotal), styles: { halign: 'right', fontStyle: 'bold' } },
        { content: ZAR(g.plannedTotal), styles: { halign: 'right', fontStyle: 'bold' } },
        '', '',
      ]);
    });

    body.push([{
      content: `GRAND TOTAL TO BE PAID (selected): ${ZAR(kpis.plannedAmount)}   ·   Urgent: ${ZAR(kpis.urgentAmount)}   ·   Approved: ${ZAR(kpis.approvedAmount)} (${kpis.approvedCount})   ·   Not approved: ${kpis.notApprovedCount}   ·   Move next: ${kpis.movedNextCount}   ·   Pending: ${kpis.pendingCount}`,
      colSpan: 15,
      styles: { fillColor: [16, 152, 116], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 8.5 },
    }]);

    const tableOptions = getStyledTableOptions();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const sideMargin = 6;
    const topMargin = 32; // room for repeated summary header + legend on continuation pages
    const bottomMargin = 22; // room for branded footer

    // Column widths (mm) sized for A4 landscape (~285mm usable)
    const columnStyles: Record<number, any> = {
      0: { cellWidth: 13 },                  // Date
      1: { cellWidth: 26 },                  // Expert
      2: { cellWidth: 18 },                  // Type
      3: { cellWidth: 24 },                  // Patient
      4: { cellWidth: 20 },                  // Matter
      5: { cellWidth: 15, halign: 'center' },// Att. Pay
      6: { cellWidth: 19, halign: 'center' },// Expert Pay
      7: { cellWidth: 15, halign: 'center' },// Report
      8: { cellWidth: 18, halign: 'right'  },// Fee Due
      9: { cellWidth: 11, halign: 'center' },// Urgent
      10:{ cellWidth: 13, halign: 'center' },// Planned
      11:{ cellWidth: 17, halign: 'right'  },// Partial
      12:{ cellWidth: 20, halign: 'right'  },// To Pay Now
      13:{ cellWidth: 22, halign: 'center' },// Approval
      14:{ cellWidth: 'auto' },              // Comment
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
        doc.rect(0, 10, pageWidth, 19, 'F');
        doc.setTextColor(40, 40, 40);
        doc.setFontSize(7.5);
        doc.text(kpiLines[0], sideMargin + 2, 15.5);
        doc.text(kpiLines[1], sideMargin + 2, 20.5);
        drawLegend(23.5);
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
      const { doc, filename } = buildPlannerPdf({ sortByDecision: exportSort === 'decision' });
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
      const { doc, filename } = buildPlannerPdf({ sortByDecision: exportSort === 'decision' });
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
      <div className="mx-auto p-2 lg:p-3 space-y-3 max-w-full">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Experts Payment Schedule</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Plan monthly payments to experts. Grouped per Referring Attorney with per-firm subtotals,
              mirroring the "Payments to be made" spreadsheet.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 max-w-full">
            <div className="flex items-center gap-1.5" title="Row order used in the exported / emailed PDF">
              <Label htmlFor="epp-export-sort" className="text-xs text-muted-foreground whitespace-nowrap">Export sort</Label>
              <Select value={exportSort} onValueChange={(v) => setExportSort(v as ExportSort)}>
                <SelectTrigger id="epp-export-sort" className="h-8 w-[170px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default (current view)</SelectItem>
                  <SelectItem value="decision">By approval decision</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={loading || !filtered.length}>
              <Download className="h-4 w-4 mr-2" /> Export PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEmailOpen(true)} disabled={loading || !filtered.length}>
              <Mail className="h-4 w-4 mr-2" /> Email PDF
            </Button>
            <Button
              variant={compareMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCompareMode(v => !v)}
              disabled={loading}
              title="Show side-by-side metrics for each selected attorney"
              aria-pressed={compareMode}
            >
              <Columns className="h-4 w-4 mr-2" /> Compare {compareMode ? 'on' : 'off'}
            </Button>
            {(() => {
              const pendingRequestCount = filtered.filter(r => {
                const pp = getPlan(r.appointment_id);
                return pp.requestStatus === 'submitted' && (pp.decision ?? 'pending') === 'pending';
              }).length;
              return (
                <Button variant="outline" size="sm" onClick={() => setApprovalsOpen(true)} disabled={loading} title="Review approval requests">
                  <Inbox className="h-4 w-4 mr-2" /> Approval Requests
                  {pendingRequestCount > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center rounded-full bg-amber-500/20 text-amber-700 text-[10px] font-semibold px-1.5 min-w-[18px] h-[18px]">
                      {pendingRequestCount}
                    </span>
                  )}
                </Button>
              );
            })()}
            <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)} disabled={loading}>
              <History className="h-4 w-4 mr-2" /> History {history.length > 0 && <span className="ml-1 inline-flex items-center justify-center rounded-full bg-primary/15 text-primary text-[10px] font-semibold px-1.5 min-w-[18px] h-[18px]">{history.length}</span>}
            </Button>
            <Button variant="default" size="sm" onClick={saveSnapshot} disabled={loading || !filtered.length} title="Save plan, send selected rows for approval and store in History">
              <Save className="h-4 w-4 mr-2" /> Save & Send for Approval
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
            <span className="h-3 w-px bg-border" />
            <span title="Approved planned amount"><span className="text-muted-foreground">Approved:</span> <span className="font-semibold tabular-nums text-emerald-700">{ZAR(kpis.approvedAmount)}</span> <span className="text-muted-foreground">({kpis.approvedCount})</span></span>
            <span><span className="text-muted-foreground">Not appr.:</span> <span className="font-semibold tabular-nums text-rose-700">{kpis.notApprovedCount}</span></span>
            <span><span className="text-muted-foreground">Next:</span> <span className="font-semibold tabular-nums text-indigo-700">{kpis.movedNextCount}</span></span>
            <span><span className="text-muted-foreground">Pending:</span> <span className="font-semibold tabular-nums">{kpis.pendingCount}</span></span>
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
            <KpiCard label="Scheduled Payment" value={ZAR(kpis.totalExpertDebt)} icon={<DollarSign className="h-4 w-4" />} />
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
              <Select value={decisionFilter} onValueChange={setDecisionFilter}>
                <SelectTrigger><SelectValue placeholder="Approval status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All approvals</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="not_approved">Not approved</SelectItem>
                  <SelectItem value="moved_next">Move to next payment</SelectItem>
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

        {compareMode && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Columns className="h-4 w-4" /> Side-by-side comparison
                <span className="text-xs font-normal text-muted-foreground">
                  {grouped.length} attorney{grouped.length === 1 ? '' : 's'} in current view
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {grouped.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-6">
                  No attorneys to compare. Adjust filters or pick attorneys above.
                </div>
              ) : grouped.length === 1 ? (
                <div className="text-sm text-muted-foreground text-center py-6">
                  Select at least two attorneys (Attorneys filter) to compare metrics side-by-side.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div
                    className="grid gap-3"
                    style={{ gridTemplateColumns: `180px repeat(${grouped.length}, minmax(180px, 1fr))` }}
                  >
                    {/* Header row */}
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground self-end pb-2">
                      Metric
                    </div>
                    {grouped.map(g => (
                      <div key={`h-${g.attorney_id}`} className="text-sm font-semibold truncate pb-2 border-b" title={g.attorney_name}>
                        {g.attorney_name}
                      </div>
                    ))}

                    {([
                      { key: 'files', label: 'Files', fmt: (g: typeof grouped[number]) => String(g.rows.length) },
                      { key: 'expertDebt', label: 'Expert debt', fmt: (g: typeof grouped[number]) => ZAR(g.totalExpertDebts) },
                      { key: 'attorneyDebt', label: 'Attorney debt', fmt: (g: typeof grouped[number]) => ZAR(g.attorneyDebt) },
                      { key: 'deposit', label: 'Deposit', fmt: (g: typeof grouped[number]) => ZAR(g.deposit) },
                      { key: 'outstanding', label: 'Outstanding', fmt: (g: typeof grouped[number]) => ZAR(g.outstanding), tone: 'warning' as const },
                      { key: 'planned', label: 'To Pay (planned)', fmt: (g: typeof grouped[number]) => ZAR(g.plannedTotal), tone: 'success' as const },
                      { key: 'urgent', label: 'Urgent', fmt: (g: typeof grouped[number]) => ZAR(g.urgentTotal), tone: 'urgent' as const },
                      { key: 'partial', label: 'Partial paid', fmt: (g: typeof grouped[number]) => ZAR(g.partialTotal) },
                      {
                        key: 'reportsReceived',
                        label: 'Reports received',
                        fmt: (g: typeof grouped[number]) => `${g.rows.filter(r => r.report_received === 'yes').length} / ${g.rows.length}`,
                      },
                      {
                        key: 'approved',
                        label: 'Approved',
                        fmt: (g: typeof grouped[number]) =>
                          String(g.rows.filter(r => (getPlan(r.appointment_id).decision ?? 'pending') === 'approved').length),
                        tone: 'success' as const,
                      },
                      {
                        key: 'notApproved',
                        label: 'Not approved',
                        fmt: (g: typeof grouped[number]) =>
                          String(g.rows.filter(r => getPlan(r.appointment_id).decision === 'not_approved').length),
                        tone: 'danger' as const,
                      },
                      {
                        key: 'movedNext',
                        label: 'Move to next',
                        fmt: (g: typeof grouped[number]) =>
                          String(g.rows.filter(r => getPlan(r.appointment_id).decision === 'moved_next').length),
                      },
                      {
                        key: 'pending',
                        label: 'Pending',
                        fmt: (g: typeof grouped[number]) =>
                          String(g.rows.filter(r => !getPlan(r.appointment_id).decision || getPlan(r.appointment_id).decision === 'pending').length),
                      },
                    ] as const).flatMap((metric, idx) => [
                      <div
                        key={`l-${metric.key}`}
                        className={`text-xs text-muted-foreground py-1.5 ${idx > 0 ? 'border-t' : ''}`}
                      >
                        {metric.label}
                      </div>,
                      ...grouped.map(g => (
                        <div
                          key={`v-${metric.key}-${g.attorney_id}`}
                          className={`text-sm font-semibold tabular-nums py-1.5 ${idx > 0 ? 'border-t' : ''} ${
                            ('tone' in metric && metric.tone === 'success') ? 'text-emerald-700' :
                            ('tone' in metric && metric.tone === 'warning') ? 'text-amber-700' :
                            ('tone' in metric && metric.tone === 'urgent') ? 'text-amber-600' :
                            ('tone' in metric && metric.tone === 'danger') ? 'text-rose-700' : ''
                          }`}
                        >
                          {metric.fmt(g)}
                        </div>
                      )),
                    ])}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Scheduled Payment</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="text-xs [&_th]:h-8 [&_th]:px-2 [&_th]:py-1 [&_th]:text-[11px] [&_td]:px-2 [&_td]:py-1.5 [&_td]:align-middle">
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Date</TableHead>
                    <TableHead>Expert</TableHead>
                    <TableHead className="w-[80px]">Type</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Matter</TableHead>
                    <TableHead>Attorney</TableHead>
                    <TableHead>Att. Pay</TableHead>
                    <TableHead>Expert Pay</TableHead>
                    <TableHead>Report</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Fee Due</TableHead>
                    <TableHead className="text-center" title="File from expert to be taken out — urgent">Urg</TableHead>
                    <TableHead className="text-center">Plan</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Partial</TableHead>
                    <TableHead className="text-right whitespace-nowrap">To Pay</TableHead>
                    {admin && <TableHead className="text-center whitespace-nowrap">Approval</TableHead>}
                    <TableHead className="w-[160px]">Comment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={admin ? 16 : 15} className="text-center py-10 text-muted-foreground">Loading…</TableCell></TableRow>
                  ) : grouped.length === 0 ? (
                    <TableRow><TableCell colSpan={admin ? 16 : 15} className="text-center py-10 text-muted-foreground">
                      No appointments match the current filters.
                    </TableCell></TableRow>
                  ) : grouped.map(g => {
                    const allPlanned = g.rows.every(r => getPlan(r.appointment_id).planned || getPlan(r.appointment_id).urgent);
                    const allUrgent = g.rows.every(r => getPlan(r.appointment_id).urgent);
                    return (
                    <React.Fragment key={g.attorney_id}>
                      <TableRow className="bg-muted/60 hover:bg-muted/60">
                        <TableCell colSpan={admin ? 16 : 15} className="font-semibold uppercase text-sm tracking-wide">
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
                              {admin && <>
                              <div className="h-5 w-px bg-border mx-1" />
                              <Button size="sm" variant="outline" className="h-7 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                onClick={() => openDecisionPrompt('approved', { kind: 'row', ids: g.rows.map(r => r.appointment_id) })}
                                title="Approve all claimants in this attorney group">
                                <ThumbsUp className="h-3.5 w-3.5 mr-1" /> Approve all
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 border-rose-300 text-rose-700 hover:bg-rose-50"
                                onClick={() => openDecisionPrompt('not_approved', { kind: 'row', ids: g.rows.map(r => r.appointment_id) })}>
                                <ThumbsDown className="h-3.5 w-3.5 mr-1" /> Not approved
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                                onClick={() => openDecisionPrompt('moved_next', { kind: 'row', ids: g.rows.map(r => r.appointment_id) })}>
                                <ArrowRightCircle className="h-3.5 w-3.5 mr-1" /> Move to next
                              </Button>
                              </>}
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
                          <TableCell className="whitespace-nowrap">{format(new Date(r.assessment_date), 'dd MMM yy')}</TableCell>
                          <TableCell className="font-medium break-words">{r.expert_name}</TableCell>
                          <TableCell className="break-words whitespace-normal max-w-[80px] leading-tight">{r.expert_type}</TableCell>
                          <TableCell className="break-words">{r.patient_name}</TableCell>
                          <TableCell className="break-words">{r.matter_type}</TableCell>
                          <TableCell className="break-words">{r.attorney_name}</TableCell>
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
                                  <SelectTrigger className={`h-7 w-[120px] text-[11px] font-medium px-2 ${EXPERT_PAY_STYLE[effective]}`}>
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
                              className="h-7 w-20 text-right ml-auto text-xs px-1.5"
                              placeholder="0.00"
                            />
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap font-bold text-emerald-700">
                            {ZAR(toPay)}
                          </TableCell>
                          {admin && (
                          <TableCell className="text-center">
                            {(() => {
                              const decision = (p.decision ?? 'pending') as ApprovalStatus;
                              const reqStatus = p.requestStatus ?? 'none';
                              return (
                                <div className="flex flex-col items-center gap-1">
                                  <Select value={decision} onValueChange={(v) => {
                                      const next = v as ApprovalStatus;
                                      if (next === 'pending') setDecision(r.appointment_id, 'pending');
                                      else openDecisionPrompt(next, { kind: 'row', ids: [r.appointment_id] });
                                    }}>
                                      <SelectTrigger className={`h-7 w-[140px] text-[11px] font-medium px-2 ${DECISION_STYLE[decision]}`}>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="pending">Pending</SelectItem>
                                        <SelectItem value="approved">Approved</SelectItem>
                                        <SelectItem value="not_approved">Not approved</SelectItem>
                                        <SelectItem value="moved_next">Move to next payment</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  {reqStatus === 'submitted' && decision === 'pending' && (
                                    <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200 text-[10px]">
                                      Awaiting admin
                                    </Badge>
                                  )}
                                  {p.decidedAt && (
                                    <span className="text-[10px] text-muted-foreground tabular-nums" title={p.decidedBy ? `By ${p.decidedBy}` : undefined}>
                                      {format(new Date(p.decidedAt), 'dd MMM HH:mm')}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </TableCell>
                          )}
                          <TableCell className="align-top w-[220px] max-w-[260px]">
                            <CommentThread
                              comments={p.comments ?? []}
                              legacy={p.comment}
                              onAdd={(t) => addComment(r.appointment_id, t)}
                              currentRole={authorRole}
                            />
                            {!admin && (p.planned || p.urgent) && (() => {
                              const decision = (p.decision ?? 'pending') as ApprovalStatus;
                              const reqStatus = p.requestStatus ?? 'none';
                              return (
                                <div className="mt-2 flex flex-col gap-1">
                                  {reqStatus === 'submitted' && decision === 'pending' ? (
                                    <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200 text-[10px] w-fit">
                                      Awaiting admin review
                                    </Badge>
                                  ) : decision !== 'pending' ? (
                                    <Badge variant="outline" className={`${DECISION_STYLE[decision]} text-[10px] w-fit`}>
                                      <Lock className="h-3 w-3 mr-1" />{DECISION_LABEL[decision]}
                                    </Badge>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 px-2 text-[10px] w-fit"
                                      onClick={() => submitForApproval(r.appointment_id)}
                                      title="Submit this row to admin for approval"
                                    >
                                      <Send className="h-3 w-3 mr-1" /> Submit for Review
                                    </Button>
                                  )}
                                  {reqStatus === 'submitted' && decision === 'pending' && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 px-2 text-[10px] w-fit text-muted-foreground"
                                      onClick={() => submitForApproval(r.appointment_id)}
                                      title="Send follow-up reminder to admin"
                                    >
                                      <Send className="h-3 w-3 mr-1" /> Follow up
                                    </Button>
                                  )}
                                </div>
                              );
                            })()}
                          </TableCell>
                        </TableRow>
                        );
                      })}
                      <TableRow className="bg-background border-b-4 border-background hover:bg-background">
                        <TableCell colSpan={admin ? 16 : 15} className="p-3">
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

        {/* Approval Requests — admin reviews submitted rows */}
        <Dialog open={approvalsOpen} onOpenChange={setApprovalsOpen}>
          <DialogContent className="sm:max-w-5xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Inbox className="h-5 w-5" /> Approval Requests
                {!admin && (
                  <Badge variant="outline" className="ml-2 bg-amber-50 text-amber-800 border-amber-200 text-[10px]">
                    <Lock className="h-3 w-3 mr-1" /> View only — admin can approve
                  </Badge>
                )}
              </DialogTitle>
            </DialogHeader>

            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Button size="sm" variant={approvalsTab === 'pending' ? 'default' : 'outline'} onClick={() => setApprovalsTab('pending')}>
                Pending requests
              </Button>
              <Button size="sm" variant={approvalsTab === 'history' ? 'default' : 'outline'} onClick={() => setApprovalsTab('history')}>
                Review history
              </Button>
              <div className="ml-auto">
                <Button size="sm" variant="outline" onClick={() => setReviewExportOpen(true)} title="Export review history (timestamps & authors) as PDF for a date range">
                  <Download className="h-4 w-4 mr-2" /> Export review history (PDF)
                </Button>
              </div>
            </div>


            {(() => {
              const requestRows = filtered
                .map(r => ({ r, p: getPlan(r.appointment_id) }))
                .filter(({ p }) => {
                  const dec = (p.decision ?? 'pending') as ApprovalStatus;
                  if (approvalsTab === 'pending') {
                    return p.requestStatus === 'submitted' && dec === 'pending';
                  }
                  // history: anything that was ever submitted OR has a non-pending decision
                  return !!p.requestedAt || (dec !== 'pending');
                })
                .sort((a, b) => {
                  const ad = a.p.requestedAt || a.p.decidedAt || '';
                  const bd = b.p.requestedAt || b.p.decidedAt || '';
                  return bd.localeCompare(ad);
                });

              if (requestRows.length === 0) {
                return (
                  <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                    {approvalsTab === 'pending'
                      ? 'No approval requests are currently waiting.'
                      : 'No reviewed requests yet.'}
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {requestRows.map(({ r, p }) => {
                    const decision = (p.decision ?? 'pending') as ApprovalStatus;
                    const toPay = (p.planned || p.urgent)
                      ? Math.max(0, r.fee_due_to_expert - (Number(p.partial) || 0))
                      : 0;
                    return (
                      <div key={r.appointment_id} className="rounded-lg border p-3 bg-card">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold">{r.patient_name}</span>
                              <span className="text-xs text-muted-foreground">·</span>
                              <span className="text-xs">{r.expert_name}</span>
                              <span className="text-xs text-muted-foreground">·</span>
                              <span className="text-xs">{r.attorney_name}</span>
                              <Badge variant="outline" className={`${DECISION_STYLE[decision]} text-[10px]`}>
                                {DECISION_LABEL[decision]}
                              </Badge>
                              {p.requestStatus === 'submitted' && decision === 'pending' && (
                                <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200 text-[10px]">
                                  Awaiting admin
                                </Badge>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              Assessment {format(new Date(r.assessment_date), 'dd MMM yyyy')}
                              {' · '}Fee due <span className="font-semibold text-foreground">{ZAR(r.fee_due_to_expert)}</span>
                              {' · '}To pay <span className="font-semibold text-emerald-700">{ZAR(toPay)}</span>
                              {p.requestedAt && (
                                <> {' · '}Submitted {fmtStamp(p.requestedAt)} by {p.requestedBy || '—'}</>
                              )}
                              {p.decidedAt && (
                                <> {' · '}{DECISION_LABEL[decision]} {fmtStamp(p.decidedAt)} by {p.decidedBy || '—'}</>
                              )}
                            </div>
                          </div>
                          {admin && (
                            <div className="flex flex-wrap gap-1">
                              <Button size="sm" variant="outline" className="h-7 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                onClick={() => openDecisionPrompt('approved', { kind: 'row', ids: [r.appointment_id] })}>
                                <ThumbsUp className="h-3.5 w-3.5 mr-1" /> Approve
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 border-rose-300 text-rose-700 hover:bg-rose-50"
                                onClick={() => openDecisionPrompt('not_approved', { kind: 'row', ids: [r.appointment_id] })}>
                                <ThumbsDown className="h-3.5 w-3.5 mr-1" /> Decline
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                                onClick={() => openDecisionPrompt('moved_next', { kind: 'row', ids: [r.appointment_id] })}>
                                <ArrowRightCircle className="h-3.5 w-3.5 mr-1" /> Move to next month
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="mt-3">
                          <CommentThread
                            comments={p.comments ?? []}
                            legacy={p.comment}
                            onAdd={(t) => addComment(r.appointment_id, t)}
                            currentRole={authorRole}
                            compact={false}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* Export review history — pick a date range */}
        <Dialog open={reviewExportOpen} onOpenChange={setReviewExportOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" /> Export review history (PDF)
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Exports every approval submission, decision, and comment (with timestamps and authors) for events that occurred in the selected range.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="rev-from" className="text-xs">From</Label>
                  <Input id="rev-from" type="date" value={reviewExportFrom} onChange={(e) => setReviewExportFrom(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="rev-to" className="text-xs">To</Label>
                  <Input id="rev-to" type="date" value={reviewExportTo} onChange={(e) => setReviewExportTo(e.target.value)} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReviewExportOpen(false)}>Cancel</Button>
              <Button onClick={exportReviewHistoryPdf}>
                <Download className="h-4 w-4 mr-2" /> Download PDF
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>



        {/* History Planner — what was planned vs approved */}
        <Dialog open={historyOpen} onOpenChange={(o) => { setHistoryOpen(o); if (!o) setHistoryDetail(null); }}>
          <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="h-5 w-5" /> History Planner — Planned vs Approved
              </DialogTitle>
            </DialogHeader>

            {!historyDetail ? (
              <div className="space-y-3">
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="snap-label">New plan label</Label>
                    <Input id="snap-label" value={snapshotLabel}
                      onChange={(e) => setSnapshotLabel(e.target.value)}
                      placeholder={`Planner ${format(new Date(), 'dd MMM yyyy')}`} />
                  </div>
                  <Button onClick={saveSnapshot} disabled={!filtered.length}>
                    <Save className="h-4 w-4 mr-2" /> Save & Send
                  </Button>
                </div>

                {/* Today's payment plans — quick resend for approval */}
                {todaysPlans.length > 0 && (
                  <div className="rounded-md border bg-amber-50/40">
                    <div className="px-3 py-2 border-b bg-amber-100/60 flex items-center justify-between">
                      <div className="text-sm font-semibold text-amber-900 flex items-center gap-2">
                        <CalendarClock className="h-4 w-4" /> Today's payment plans
                        <Badge variant="outline" className="bg-amber-200/60 text-amber-900 border-amber-300">{todaysPlans.length}</Badge>
                      </div>
                      <div className="text-xs text-amber-800">Re-send any plan submitted today for admin approval.</div>
                    </div>
                    <div className="divide-y">
                      {todaysPlans.map(h => {
                        const st = h.approvalStatus ?? 'pending';
                        return (
                          <div key={`today-${h.id}`} className="px-3 py-2 flex items-center gap-2 flex-wrap">
                            <div className="flex-1 min-w-[200px]">
                              <div className="text-sm font-medium">{h.label}</div>
                              <div className="text-[11px] text-muted-foreground tabular-nums">
                                {format(new Date(h.created_at), 'HH:mm')} · {h.totals.rows} files · {ZAR(h.totals.plannedAmount)}
                                {h.submittedForApprovalAt && ` · sent ${fmtStamp(h.submittedForApprovalAt)}`}
                              </div>
                            </div>
                            <Badge variant="outline" className={
                              st === 'approved' ? DECISION_STYLE.approved
                              : st === 'not_approved' ? DECISION_STYLE.not_approved
                              : DECISION_STYLE.pending
                            }>
                              {st === 'approved' ? 'Approved' : st === 'not_approved' ? 'Declined' : 'Pending'}
                            </Badge>
                            <Button size="sm" variant="outline" onClick={() => sendSnapshotForApproval(h.id)}>
                              <Send className="h-3 w-3 mr-1" /> Re-send for approval
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setHistoryDetail(h)}>View</Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {history.length === 0 ? (
                  <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                    No saved plans yet. Save the current planner state to start tracking history.
                  </div>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Plan</TableHead>
                          <TableHead className="text-center">Approval</TableHead>
                          <TableHead className="text-right">Planned</TableHead>
                          <TableHead className="text-right">Approved</TableHead>
                          <TableHead className="text-center">Decisions</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {history.map(h => {
                          const st = h.approvalStatus ?? 'pending';
                          const stLabel = st === 'approved' ? 'Approved' : st === 'not_approved' ? 'Declined' : 'Pending';
                          const stClass = st === 'approved' ? DECISION_STYLE.approved : st === 'not_approved' ? DECISION_STYLE.not_approved : DECISION_STYLE.pending;
                          return (
                            <TableRow key={h.id}>
                              <TableCell>
                                <div className="font-medium">{h.label}</div>
                                <div className="text-xs text-muted-foreground tabular-nums">
                                  {format(new Date(h.created_at), 'dd MMM yyyy HH:mm')} · {h.totals.rows} files · {h.totals.attorneys} attorneys
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className={stClass}>{stLabel}</Badge>
                                {h.approvedBy && (
                                  <div className="text-[10px] text-muted-foreground mt-0.5">{h.approvedBy}</div>
                                )}
                              </TableCell>
                              <TableCell className="text-right tabular-nums font-semibold">{ZAR(h.totals.plannedAmount)}</TableCell>
                              <TableCell className="text-right tabular-nums font-semibold text-emerald-700">{ZAR(h.totals.approvedAmount)}</TableCell>
                              <TableCell className="text-center">
                                <div className="flex justify-center gap-1 flex-wrap">
                                  <Badge variant="outline" className={DECISION_STYLE.approved}>✓ {h.totals.approvedCount}</Badge>
                                  <Badge variant="outline" className={DECISION_STYLE.not_approved}>✗ {h.totals.notApprovedCount}</Badge>
                                  <Badge variant="outline" className={DECISION_STYLE.moved_next}>→ {h.totals.movedNextCount}</Badge>
                                  <Badge variant="outline" className={DECISION_STYLE.pending}>… {h.totals.pendingCount}</Badge>
                                </div>
                              </TableCell>
                              <TableCell className="text-right whitespace-nowrap">
                                <Button size="sm" variant="outline" onClick={() => setHistoryDetail(h)}>View</Button>
                                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteSnapshot(h.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <div className="text-base font-semibold flex items-center gap-2">
                      {historyDetail.label}
                      {(() => {
                        const st = historyDetail.approvalStatus ?? 'pending';
                        const stLabel = st === 'approved' ? 'Approved' : st === 'not_approved' ? 'Declined' : 'Pending approval';
                        const stClass = st === 'approved' ? DECISION_STYLE.approved : st === 'not_approved' ? DECISION_STYLE.not_approved : DECISION_STYLE.pending;
                        return <Badge variant="outline" className={stClass}>{stLabel}</Badge>;
                      })()}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(historyDetail.created_at), 'dd MMM yyyy HH:mm')} · {historyDetail.totals.rows} files
                      {historyDetail.submittedBy && ` · submitted by ${historyDetail.submittedBy}`}
                      {historyDetail.approvedBy && ` · ${historyDetail.approvalStatus === 'approved' ? 'approved' : 'decided'} by ${historyDetail.approvedBy} ${historyDetail.approvedAt ? fmtStamp(historyDetail.approvedAt) : ''}`}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => setHistoryDetail(null)}>← Back</Button>
                    <Button size="sm" variant="outline" onClick={() => sendSnapshotForApproval(historyDetail.id)}>
                      <Send className="h-3 w-3 mr-1" /> Re-send for approval
                    </Button>
                    {admin && (historyDetail.approvalStatus ?? 'pending') !== 'approved' && (
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => approveSnapshot(historyDetail.id)}>
                        <ThumbsUp className="h-3 w-3 mr-1" /> Approve
                      </Button>
                    )}
                    {admin && (historyDetail.approvalStatus ?? 'pending') !== 'not_approved' && (
                      <Button size="sm" variant="outline" className="text-rose-700 border-rose-300" onClick={() => declineSnapshot(historyDetail.id)}>
                        <ThumbsDown className="h-3 w-3 mr-1" /> Decline
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => exportSnapshotPdf(historyDetail)}
                      disabled={(historyDetail.approvalStatus ?? 'pending') !== 'approved'}
                      title={(historyDetail.approvalStatus ?? 'pending') !== 'approved' ? 'Approve the plan to unlock' : 'Export approved plan as PDF'}>
                      <Download className="h-3 w-3 mr-1" /> Export PDF
                    </Button>
                    <Button size="sm" onClick={() => openEmailSnapshot(historyDetail)}
                      disabled={(historyDetail.approvalStatus ?? 'pending') !== 'approved'}
                      title={(historyDetail.approvalStatus ?? 'pending') !== 'approved' ? 'Approve the plan to unlock' : 'Email approved plan'}>
                      <Mail className="h-3 w-3 mr-1" /> Email
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => restoreSnapshot(historyDetail)}>Restore decisions</Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <SummaryStat label="Planned amount" value={ZAR(historyDetail.totals.plannedAmount)} />
                  <SummaryStat label="Approved amount" value={ZAR(historyDetail.totals.approvedAmount)} tone="success" />
                  <SummaryStat label="Urgent amount" value={ZAR(historyDetail.totals.urgentAmount)} tone="warning" />
                  <SummaryStat label={`Decisions (A/N/Next/Pending)`}
                    value={`${historyDetail.totals.approvedCount} / ${historyDetail.totals.notApprovedCount} / ${historyDetail.totals.movedNextCount} / ${historyDetail.totals.pendingCount}`} />
                </div>

                <div className="rounded-md border overflow-hidden max-h-[50vh] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Attorney</TableHead>
                        <TableHead>Claimant</TableHead>
                        <TableHead>Expert</TableHead>
                        <TableHead className="text-right">Fee Due</TableHead>
                        <TableHead className="text-right">To Pay</TableHead>
                        <TableHead className="text-center">Planned</TableHead>
                        <TableHead className="text-center">Decision</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyDetail.entries.map(e => (
                        <TableRow key={e.appointment_id}>
                          <TableCell className="whitespace-nowrap text-xs">{format(new Date(e.assessment_date), 'dd MMM yy')}</TableCell>
                          <TableCell className="text-xs">{e.attorney_name}</TableCell>
                          <TableCell className="text-xs">{e.patient_name}</TableCell>
                          <TableCell className="text-xs">{e.expert_name}</TableCell>
                          <TableCell className="text-right text-xs tabular-nums">{ZAR(e.fee_due)}</TableCell>
                          <TableCell className="text-right text-xs tabular-nums font-semibold text-emerald-700">{ZAR(e.to_pay)}</TableCell>
                          <TableCell className="text-center text-xs">
                            {e.urgent ? <Badge variant="outline" className="bg-rose-100 text-rose-800 border-rose-300">Urgent</Badge>
                              : e.planned ? <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">Planned</Badge>
                              : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={DECISION_STYLE[e.decision]}>{DECISION_LABEL[e.decision]}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Email approved snapshot dialog */}
        <Dialog open={snapEmailOpen} onOpenChange={setSnapEmailOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" /> Email Approved Plan
              </DialogTitle>
            </DialogHeader>
            {snapEmailTarget && (
              <div className="space-y-3">
                <div className="rounded-md border bg-emerald-50/60 p-2 text-xs text-emerald-900">
                  <span className="font-semibold">{snapEmailTarget.label}</span> · Approved{snapEmailTarget.approvedBy ? ` by ${snapEmailTarget.approvedBy}` : ''}{snapEmailTarget.approvedAt ? ` on ${fmtStamp(snapEmailTarget.approvedAt)}` : ''}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="snap-to">To<span className="text-destructive">*</span></Label>
                  <Input id="snap-to" value={snapEmailTo} onChange={(e) => { setSnapEmailTo(e.target.value); setSnapEmailToError(null); }}
                    placeholder="finance@example.com, ops@example.com" />
                  {snapEmailToError && <p className="text-xs text-destructive">{snapEmailToError}</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="snap-cc">CC</Label>
                  <Input id="snap-cc" value={snapEmailCc} onChange={(e) => { setSnapEmailCc(e.target.value); setSnapEmailCcError(null); }} />
                  {snapEmailCcError && <p className="text-xs text-destructive">{snapEmailCcError}</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="snap-subj">Subject</Label>
                  <Input id="snap-subj" value={snapEmailSubject} onChange={(e) => setSnapEmailSubject(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="snap-msg">Message</Label>
                  <Textarea id="snap-msg" rows={4} value={snapEmailMessage} onChange={(e) => setSnapEmailMessage(e.target.value)} />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setSnapEmailOpen(false)} disabled={sending}>Cancel</Button>
              <Button onClick={sendSnapshotEmail} disabled={sending}>
                {sending ? 'Sending…' : (<><Mail className="h-4 w-4 mr-2" /> Send</>)}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Required-comment prompt for admin decisions */}
        <Dialog
          open={!!decisionPrompt?.open}
          onOpenChange={(o) => { if (!o) setDecisionPrompt(null); }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {decisionPrompt?.decision === 'approved' && <ThumbsUp className="h-5 w-5 text-emerald-600" />}
                {decisionPrompt?.decision === 'not_approved' && <ThumbsDown className="h-5 w-5 text-rose-600" />}
                {decisionPrompt?.decision === 'moved_next' && <ArrowRightCircle className="h-5 w-5 text-indigo-600" />}
                {decisionPrompt ? DECISION_LABEL[decisionPrompt.decision] : ''} — explanation required
              </DialogTitle>
            </DialogHeader>
            {decisionPrompt && (
              <div className="space-y-3">
                <div className="rounded-md border bg-muted/40 p-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Target: </span>
                    <span className="font-medium">
                      {decisionPrompt.target.kind === 'row'
                        ? `${decisionPrompt.target.ids.length} payment row${decisionPrompt.target.ids.length === 1 ? '' : 's'}`
                        : 'Payment plan snapshot'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">By: </span>
                    <span className="font-medium">{currentUserName}</span>
                    <span className="text-muted-foreground"> · </span>
                    <span className="font-medium tabular-nums">{fmtStamp(new Date().toISOString())}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="decision-comment">
                    Reason / explanation <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="decision-comment"
                    rows={4}
                    autoFocus
                    placeholder={
                      decisionPrompt.decision === 'approved'
                        ? 'e.g. Funds available, invoices verified, attorney AOD in place.'
                        : decisionPrompt.decision === 'not_approved'
                        ? 'e.g. Expert report outstanding, attorney debt unresolved.'
                        : 'e.g. Cashflow tight this month, defer to next payment cycle.'
                    }
                    value={decisionPrompt.comment}
                    onChange={(e) => setDecisionPrompt({ ...decisionPrompt, comment: e.target.value, error: null })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        confirmDecisionPrompt();
                      }
                    }}
                  />
                  {decisionPrompt.error && <p className="text-xs text-destructive">{decisionPrompt.error}</p>}
                  <p className="text-[11px] text-muted-foreground">
                    This comment will be timestamped and attached to the audit trail. Ctrl/Cmd + Enter to submit.
                  </p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDecisionPrompt(null)}>Cancel</Button>
              <Button
                onClick={confirmDecisionPrompt}
                className={
                  decisionPrompt?.decision === 'approved'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : decisionPrompt?.decision === 'not_approved'
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }
              >
                Confirm {decisionPrompt ? DECISION_LABEL[decisionPrompt.decision].toLowerCase() : ''}
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

const CommentThread: React.FC<{
  comments: CommentEntry[];
  legacy?: string;
  onAdd: (text: string) => void;
  currentRole: 'admin' | 'employee';
  compact?: boolean;
}> = ({ comments, legacy, onAdd, currentRole, compact = true }) => {
  const [draft, setDraft] = useState('');
  const handleSend = () => {
    if (!draft.trim()) return;
    onAdd(draft);
    setDraft('');
  };
  const hasLegacy = !!(legacy && legacy.trim() && comments.length === 0);
  return (
    <div className="flex flex-col gap-1.5">
      <div className={`flex flex-col gap-1 ${compact ? 'max-h-[120px]' : 'max-h-[260px]'} overflow-y-auto pr-1`}>
        {hasLegacy && (
          <div className="rounded-md border bg-muted/30 px-2 py-1 text-[11px] leading-snug break-words whitespace-pre-wrap [overflow-wrap:anywhere]">
            <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Legacy note</div>
            {legacy}
          </div>
        )}
        {comments.length === 0 && !hasLegacy && (
          <div className="text-[11px] text-muted-foreground italic">No comments yet.</div>
        )}
        {comments.map(c => (
          <div
            key={c.id}
            className={`rounded-md border px-2 py-1 text-[11px] leading-snug break-words whitespace-pre-wrap [overflow-wrap:anywhere] ${
              c.author_role === 'admin'
                ? 'bg-indigo-50 border-indigo-200'
                : 'bg-emerald-50/60 border-emerald-200'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <span className={`text-[9px] uppercase tracking-wide font-semibold ${
                c.author_role === 'admin' ? 'text-indigo-700' : 'text-emerald-700'
              }`}>
                {c.author_role === 'admin' ? 'Admin' : 'Employee'} · {c.author_name}
              </span>
              <span className="text-[9px] text-muted-foreground tabular-nums whitespace-nowrap">
                {fmtStamp(c.at)}
              </span>
            </div>
            {c.text}
          </div>
        ))}
      </div>
      <div className="flex items-end gap-1">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={`Add ${currentRole === 'admin' ? 'admin' : 'employee'} comment… (Ctrl+Enter)`}
          className="min-h-[34px] max-h-[80px] text-[11px] leading-snug resize-none break-words"
          rows={1}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 px-2"
          onClick={handleSend}
          disabled={!draft.trim()}
          title="Add comment"
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};

export default AdminExpertPaymentPlanner;
