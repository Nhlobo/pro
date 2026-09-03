import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Mail, Receipt, PauseCircle, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import {
  AdminCard,
  AdminCardHeader,
  AdminCardBody,
  AdminEmptyState,
  AdminErrorState,
  AdminLoadingState,
  AdminPagination,
  AdminPill,
  AdminSearchInput,
} from '@/components/admin/ui/AdminUI';
import InternalInvoiceDetailSheet from './InternalInvoiceDetailSheet';

// Row shapes read directly from internal_invoices,
// internal_invoice_delivery_queue, and internal_invoice_email_log.
// Field names match exactly what internal-invoice-delivery-processor's
// loadAndValidateInvoice already selects from internal_invoices — this
// component never recalculates or writes any of these values.
export interface InternalInvoiceRow {
  id: string;
  invoice_number: string;
  status: string;
  amount: number;
  vat_amount: number;
  total_amount: number;
  invoice_date: string;
  due_date: string | null;
  appointment_id: string;
  claimant_id: string | null;
  expert_id: string | null;
  referring_attorney_id: string | null;
  needs_review_reason: string | null;
  needs_review_flagged_at: string | null;
}

export interface DeliveryQueueRow {
  id: string;
  internal_invoice_id: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  attempts: number;
  last_error: string | null;
  claimed_at: string | null;
  processed_at: string | null;
  created_at: string;
}

export interface EmailLogRow {
  id: string;
  internal_invoice_id: string;
  sent_at: string;
  resend_message_id: string | null;
  recipient_email: string;
}

export interface InvoiceListItem {
  invoice: InternalInvoiceRow;
  attorneyName: string | null;
  claimantName: string | null;
  expertName: string | null;
  appointmentLabel: string | null;
  deliveryStatus: DeliveryQueueRow['status'] | 'not_queued';
  deliveryRow: DeliveryQueueRow | null;
  emailLog: EmailLogRow | null;
}

const PAGE_SIZE = 20;
// Safety cap on how many internal_invoices rows are pulled per fetch.
// This project's live internal_invoices table was confirmed at 458 rows
// total (see the earlier investigation), so a single bounded fetch is
// sufficient without server-side cross-table filtering.
const FETCH_CAP = 1000;

function formatRand(amount: number | null | undefined): string {
  if (amount == null) return '—';
  return `R ${amount.toFixed(2)}`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' });
}

function invoiceStatusTone(status: string): 'success' | 'warning' | 'destructive' | 'neutral' {
  if (status === 'active') return 'success';
  if (status === 'void' || status === 'cancelled') return 'destructive';
  // 'needs_review' is the actual live status written by
  // reconcile_internal_invoices() when a re-assessed appointment's fee no
  // longer matches its original (voided) invoice total. 'flagged'/'review'
  // are kept as defensive fallbacks only — they are not values the live
  // pipeline currently writes.
  if (status === 'needs_review' || status === 'flagged' || status === 'review') return 'warning';
  return 'neutral';
}

// Human-readable label for invoice_number status — keeps the raw db value
// (e.g. 'needs_review') out of the UI without changing what's stored.
function invoiceStatusLabel(status: string): string {
  switch (status) {
    case 'needs_review':
      return 'Needs Review';
    case 'active':
      return 'Active';
    case 'void':
      return 'Void';
    default:
      return status;
  }
}

function deliveryStatusTone(status: InvoiceListItem['deliveryStatus']): 'success' | 'warning' | 'destructive' | 'neutral' {
  switch (status) {
    case 'success':
      return 'success';
    case 'failed':
      return 'destructive';
    case 'pending':
    case 'processing':
      return 'warning';
    default:
      return 'neutral';
  }
}

function deliveryStatusLabel(status: InvoiceListItem['deliveryStatus']): string {
  switch (status) {
    case 'success':
      return 'Emailed';
    case 'failed':
      return 'Failed';
    case 'pending':
      return 'Pending';
    case 'processing':
      return 'Processing';
    default:
      return 'Not queued';
  }
}

// Toggle for public.system_settings.internal_invoice_sending_paused —
// the flag internal-invoice-delivery-processor checks before claiming
// any batch/single_test work (never affects on-demand PDF viewing).
// null = not loaded yet (button hidden); true/false = actual DB state,
// kept in sync via realtime so a pause/restore from another tab or
// staff member is reflected here too.
function InvoiceSendingPauseControl() {
  const [paused, setPaused] = useState<boolean | null>(null);
  const [toggling, setToggling] = useState(false);

  const fetchState = useCallback(async () => {
    const { data, error } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'internal_invoice_sending_paused')
      .maybeSingle();
    if (error) {
      console.error('[InvoiceSendingPauseControl] failed to load pause state', error);
      return;
    }
    setPaused(data?.setting_value === true);
  }, []);

  useEffect(() => {
    fetchState();
    const channel = supabase
      .channel('internal-invoice-pause-flag')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'system_settings',
          filter: 'setting_key=eq.internal_invoice_sending_paused',
        },
        (payload) => setPaused((payload.new as { setting_value?: unknown })?.setting_value === true),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchState]);

  const toggle = async () => {
    if (paused === null || toggling) return;
    setToggling(true);
    const nextPaused = !paused;
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('system_settings')
      .update({
        setting_value: nextPaused,
        updated_by: userData?.user?.id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('setting_key', 'internal_invoice_sending_paused');
    setToggling(false);
    if (error) {
      toast.error(`Could not update invoice sending state: ${error.message}`);
      return;
    }
    setPaused(nextPaused);
    toast.success(nextPaused ? 'Internal invoice sending paused.' : 'Internal invoice sending restored.');
  };

  if (paused === null) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={toggling}
      className={`flex h-9 items-center gap-1.5 rounded-none border px-3 text-xs font-medium text-white transition-colors disabled:opacity-60 ${
        paused ? 'border-rose-700 bg-rose-600 hover:bg-rose-700' : 'gradient-teal'
      }`}
      title={
        paused
          ? 'Invoice sending is paused — click to restore'
          : 'Invoice sending is active — click to pause'
      }
    >
      {paused ? <RotateCcw className="h-3.5 w-3.5" /> : <PauseCircle className="h-3.5 w-3.5" />}
      {paused ? 'Restore Sending Internal Invoices' : 'Pause Internal Invoice Sending'}
    </button>
  );
}

export default function InternalInvoicesTable() {
  const [items, setItems] = useState<InvoiceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string>('all');
  // Defaults to "Emailed" (delivery status 'success') on open — this is
  // the view finance staff actually want first: "did this invoice
  // auto-send correctly." All other states (Not queued/Pending/
  // Processing/Failed) are one dropdown change away, never hidden or
  // removed — see the deliveryStatusFilter <Select> options below.
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<string>('success');
  const [page, setPage] = useState(1);

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('internal_invoices')
        .select(
          'id, invoice_number, status, amount, vat_amount, total_amount, invoice_date, due_date, appointment_id, claimant_id, expert_id, referring_attorney_id, needs_review_reason, needs_review_flagged_at',
        )
        .order('invoice_date', { ascending: false })
        .order('id', { ascending: false })
        .limit(FETCH_CAP);

      if (search.trim()) {
        query = query.ilike('invoice_number', `%${search.trim()}%`);
      }
      if (invoiceStatusFilter !== 'all') {
        query = query.eq('status', invoiceStatusFilter);
      }

      const { data: invoiceRows, error: invoiceError } = await query;
      if (invoiceError) throw invoiceError;

      const invoices = (invoiceRows ?? []) as InternalInvoiceRow[];

      const attorneyIds = [...new Set(invoices.map((i) => i.referring_attorney_id).filter(Boolean))] as string[];
      const claimantIds = [...new Set(invoices.map((i) => i.claimant_id).filter(Boolean))] as string[];
      const expertIds = [...new Set(invoices.map((i) => i.expert_id).filter(Boolean))] as string[];
      const appointmentIds = [...new Set(invoices.map((i) => i.appointment_id).filter(Boolean))] as string[];
      const invoiceIds = invoices.map((i) => i.id);

      // `.in('col', [])` is a safe no-op against PostgREST (returns zero
      // rows, never errors), so these always run unconditionally rather
      // than branching on a Promise.resolve(...) fallback — that branch
      // previously caused these to lose their real Supabase response
      // typing (data ended up typed as `never[]`).
      const NIL = ['00000000-0000-0000-0000-000000000000'];
      const [attorneysRes, claimantsRes, expertsRes, appointmentsRes, queueRes, emailLogRes] = await Promise.all([
        supabase.from('referring_attorneys').select('id, name').in('id', attorneyIds.length ? attorneyIds : NIL),
        supabase.from('claimants').select('id, first_name, last_name').in('id', claimantIds.length ? claimantIds : NIL),
        supabase.from('medical_experts').select('id, first_name, last_name').in('id', expertIds.length ? expertIds : NIL),
        supabase.from('appointments').select('id, appointment_date, assessment_code').in('id', appointmentIds.length ? appointmentIds : NIL),
        supabase.from('internal_invoice_delivery_queue').select('*').in('internal_invoice_id', invoiceIds.length ? invoiceIds : NIL),
        supabase.from('internal_invoice_email_log').select('*').in('internal_invoice_id', invoiceIds.length ? invoiceIds : NIL),
      ]);

      if (attorneysRes.error) throw attorneysRes.error;
      if (claimantsRes.error) throw claimantsRes.error;
      if (expertsRes.error) throw expertsRes.error;
      if (appointmentsRes.error) throw appointmentsRes.error;
      if (queueRes.error) throw queueRes.error;
      if (emailLogRes.error) throw emailLogRes.error;

      const attorneyById = new Map<string, string>(
        (attorneysRes.data ?? []).map((a: any): [string, string] => [a.id, a.name]),
      );
      const claimantById = new Map<string, string>(
        (claimantsRes.data ?? []).map((c: any): [string, string] => [c.id, `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim()]),
      );
      const expertById = new Map<string, string>(
        (expertsRes.data ?? []).map((e: any): [string, string] => [e.id, `${e.first_name ?? ''} ${e.last_name ?? ''}`.trim()]),
      );
      const appointmentById = new Map<string, { appointment_date: string; assessment_code: string | null }>(
        (appointmentsRes.data ?? []).map((a: any): [string, any] => [a.id, a]),
      );

      // An invoice can have more than one delivery-queue row over its
      // lifetime (e.g. a failed attempt followed by a later retry) —
      // the active-row unique index only guards one "in-flight" row at
      // a time, not the full history. Keep the most recent per invoice.
      const queueByInvoice = new Map<string, DeliveryQueueRow>();
      for (const row of (queueRes.data ?? []) as DeliveryQueueRow[]) {
        const existing = queueByInvoice.get(row.internal_invoice_id);
        if (!existing || new Date(row.created_at) > new Date(existing.created_at)) {
          queueByInvoice.set(row.internal_invoice_id, row);
        }
      }
      const emailLogByInvoice = new Map<string, EmailLogRow>(
        ((emailLogRes.data ?? []) as EmailLogRow[]).map((row): [string, EmailLogRow] => [row.internal_invoice_id, row]),
      );

      const merged: InvoiceListItem[] = invoices.map((invoice) => {
        const appt = invoice.appointment_id ? appointmentById.get(invoice.appointment_id) : null;
        const appointmentLabel = appt
          ? appt.assessment_code || formatDate(appt.appointment_date)
          : null;
        const deliveryRow = queueByInvoice.get(invoice.id) ?? null;
        return {
          invoice,
          attorneyName: invoice.referring_attorney_id ? attorneyById.get(invoice.referring_attorney_id) ?? null : null,
          claimantName: invoice.claimant_id ? claimantById.get(invoice.claimant_id) ?? null : null,
          expertName: invoice.expert_id ? expertById.get(invoice.expert_id) ?? null : null,
          appointmentLabel,
          deliveryStatus: deliveryRow?.status ?? 'not_queued',
          deliveryRow,
          emailLog: emailLogByInvoice.get(invoice.id) ?? null,
        };
      });

      setItems(merged);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load internal invoices.');
    } finally {
      setLoading(false);
    }
  }, [search, invoiceStatusFilter]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Realtime: same technique already used elsewhere in AdminFinance.tsx
  // (postgres_changes on aod_documents / short_term_agreements /
  // appointments) — any change on the three tables this tab reads
  // triggers a debounced refetch rather than fine-grained patching, to
  // keep the merge logic in one place.
  useEffect(() => {
    const scheduleRefetch = () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      refetchTimer.current = setTimeout(() => {
        fetchInvoices();
      }, 600);
    };

    const channel = supabase
      .channel('internal-invoices-tab')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'internal_invoices' }, scheduleRefetch)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'internal_invoice_delivery_queue' },
        scheduleRefetch,
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'internal_invoice_email_log' }, scheduleRefetch)
      .subscribe();

    return () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      supabase.removeChannel(channel);
    };
  }, [fetchInvoices]);

  const applySearch = () => {
    setSearch(searchDraft);
    setPage(1);
  };

  const filteredItems = useMemo(() => {
    if (deliveryStatusFilter === 'all') return items;
    return items.filter((item) => item.deliveryStatus === deliveryStatusFilter);
  }, [items, deliveryStatusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const startIndex = (page - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const pageItems = filteredItems.slice(startIndex, endIndex);

  return (
    <AdminCard>
      <AdminCardHeader
        icon={Receipt}
        title="Internal Invoices"
        description={
          deliveryStatusFilter === 'all'
            ? `${filteredItems.length} invoice${filteredItems.length === 1 ? '' : 's'}`
            : `${filteredItems.length} ${deliveryStatusLabel(deliveryStatusFilter as InvoiceListItem['deliveryStatus']).toLowerCase()} invoice${filteredItems.length === 1 ? '' : 's'} — showing "${deliveryStatusLabel(deliveryStatusFilter as InvoiceListItem['deliveryStatus'])}" only`
        }
        actions={<InvoiceSendingPauseControl />}
      />

      <AdminCardBody className="flex flex-col gap-3 border-b border-black/10 sm:flex-row sm:items-center">
        <AdminSearchInput
          value={searchDraft}
          onChange={setSearchDraft}
          placeholder="Search invoice number…"
          className="flex-1"
          inputClassName="h-9"
        />
        <div className="flex gap-2">
          <Select
            value={invoiceStatusFilter}
            onValueChange={(v: string) => {
              setInvoiceStatusFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-[150px] rounded-none border-black/15">
              <SelectValue placeholder="Invoice status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="needs_review">Needs Review</SelectItem>
              <SelectItem value="void">Void</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={deliveryStatusFilter}
            onValueChange={(v: string) => {
              setDeliveryStatusFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-[160px] rounded-none border-black/15">
              <SelectValue placeholder="Delivery status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All delivery states</SelectItem>
              <SelectItem value="not_queued">Not queued</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="success">Emailed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <button
            type="button"
            onClick={applySearch}
            className="gradient-teal rounded-none border px-3 text-xs font-medium text-white"
          >
            Search
          </button>
        </div>
      </AdminCardBody>

      {loading ? (
        <AdminLoadingState label="Loading invoices…" />
      ) : error ? (
        <AdminErrorState message={error} onRetry={fetchInvoices} />
      ) : filteredItems.length === 0 ? (
        <AdminEmptyState
          icon={FileText}
          title={deliveryStatusFilter === 'all' ? 'No invoices found' : `No "${deliveryStatusLabel(deliveryStatusFilter as InvoiceListItem['deliveryStatus'])}" invoices`}
          description={
            deliveryStatusFilter === 'all'
              ? 'Invoices appear here automatically once a report is delivered and reconciled.'
              : 'Try "All delivery states" to see invoices in other stages, such as those not yet queued.'
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Appointment / Claimant</TableHead>
                  <TableHead>Expert</TableHead>
                  <TableHead>Referring Attorney</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">VAT</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Invoice Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Delivery</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((item) => (
                  <TableRow
                    key={item.invoice.id}
                    className="cursor-pointer hover:bg-black/5"
                    onClick={() => setSelectedInvoiceId(item.invoice.id)}
                  >
                    <TableCell className="font-medium">{item.invoice.invoice_number}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{item.claimantName || '—'}</span>
                        {item.appointmentLabel && (
                          <span className="text-xs text-slate-500">{item.appointmentLabel}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{item.expertName || '—'}</TableCell>
                    <TableCell>{item.attorneyName || '—'}</TableCell>
                    <TableCell className="text-right">{formatRand(item.invoice.amount)}</TableCell>
                    <TableCell className="text-right">{formatRand(item.invoice.vat_amount)}</TableCell>
                    <TableCell className="text-right font-medium">{formatRand(item.invoice.total_amount)}</TableCell>
                    <TableCell>
                      <AdminPill tone={invoiceStatusTone(item.invoice.status)}>
                        {invoiceStatusLabel(item.invoice.status)}
                        {item.invoice.status === 'needs_review' && (
                          <span className="ml-1" aria-hidden="true" title="Requires staff attention">
                            ⚠
                          </span>
                        )}
                      </AdminPill>
                    </TableCell>
                    <TableCell>{formatDate(item.invoice.invoice_date)}</TableCell>
                    <TableCell>{formatDate(item.invoice.due_date)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <AdminPill tone={deliveryStatusTone(item.deliveryStatus)}>
                          {deliveryStatusLabel(item.deliveryStatus)}
                        </AdminPill>
                        {item.emailLog && <Mail className="h-3.5 w-3.5 text-slate-400" aria-label="Email sent" />}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <AdminPagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            totalItems={filteredItems.length}
            startIndex={startIndex}
            endIndex={endIndex}
          />
        </>
      )}

      <InternalInvoiceDetailSheet
        invoiceId={selectedInvoiceId}
        open={selectedInvoiceId != null}
        onOpenChange={(open) => {
          if (!open) setSelectedInvoiceId(null);
        }}
      />
    </AdminCard>
  );
}
