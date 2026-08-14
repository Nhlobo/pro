import React, { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Download, Loader2 } from 'lucide-react';
import { AdminPill, AdminLoadingState, AdminErrorState } from '@/components/admin/ui/AdminUI';
import type { DeliveryQueueRow, EmailLogRow, InternalInvoiceRow } from './InternalInvoicesTable';

interface InternalInvoiceDetailSheetProps {
  invoiceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DetailData {
  invoice: InternalInvoiceRow;
  attorneyName: string | null;
  claimantName: string | null;
  appointmentLabel: string | null;
  queueRows: DeliveryQueueRow[]; // full history, most recent first
  emailLog: EmailLogRow | null;
}

function formatRand(amount: number | null | undefined): string {
  if (amount == null) return '—';
  return `R ${amount.toFixed(2)}`;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function deliveryStatusTone(status: string): 'success' | 'warning' | 'destructive' | 'neutral' {
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

export default function InternalInvoiceDetailSheet({ invoiceId, open, onOpenChange }: InternalInvoiceDetailSheetProps) {
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!open || !invoiceId) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setData(null);
      try {
        const { data: invoiceRow, error: invoiceError } = await supabase
          .from('internal_invoices')
          .select(
            'id, invoice_number, status, amount, vat_amount, total_amount, invoice_date, due_date, appointment_id, claimant_id, expert_id, referring_attorney_id',
          )
          .eq('id', invoiceId)
          .maybeSingle();
        if (invoiceError) throw invoiceError;
        if (!invoiceRow) throw new Error('Invoice not found.');

        const invoice = invoiceRow as InternalInvoiceRow;

        const [attorneyRes, claimantRes, appointmentRes, queueRes, emailLogRes] = await Promise.all([
          invoice.referring_attorney_id
            ? supabase.from('referring_attorneys').select('name').eq('id', invoice.referring_attorney_id).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          invoice.claimant_id
            ? supabase.from('claimants').select('first_name, last_name').eq('id', invoice.claimant_id).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          invoice.appointment_id
            ? supabase.from('appointments').select('appointment_date, assessment_code').eq('id', invoice.appointment_id).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          supabase
            .from('internal_invoice_delivery_queue')
            .select('*')
            .eq('internal_invoice_id', invoiceId)
            .order('created_at', { ascending: false }),
          supabase.from('internal_invoice_email_log').select('*').eq('internal_invoice_id', invoiceId).maybeSingle(),
        ]);

        if (attorneyRes.error) throw attorneyRes.error;
        if (claimantRes.error) throw claimantRes.error;
        if (appointmentRes.error) throw appointmentRes.error;
        if (queueRes.error) throw queueRes.error;
        if (emailLogRes.error) throw emailLogRes.error;

        if (cancelled) return;

        const appt = appointmentRes.data as { appointment_date: string; assessment_code: string | null } | null;
        const claimant = claimantRes.data as { first_name: string; last_name: string } | null;

        setData({
          invoice,
          attorneyName: (attorneyRes.data as { name: string } | null)?.name ?? null,
          claimantName: claimant ? `${claimant.first_name ?? ''} ${claimant.last_name ?? ''}`.trim() : null,
          appointmentLabel: appt ? appt.assessment_code || appt.appointment_date : null,
          queueRows: (queueRes.data ?? []) as DeliveryQueueRow[],
          emailLog: (emailLogRes.data as EmailLogRow | null) ?? null,
        });
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? 'Failed to load invoice details.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [open, invoiceId]);

  const handleDownload = async () => {
    if (!invoiceId) return;
    setDownloading(true);
    try {
      const { data: result, error: invokeError } = await supabase.functions.invoke('internal-invoice-delivery-processor', {
        body: { mode: 'get_pdf', internalInvoiceId: invoiceId },
      });
      if (invokeError) throw invokeError;
      if (!result?.pdf) throw new Error('No PDF returned.');

      // Same base64 -> Blob -> download pattern already used for
      // generate-aod-pdf elsewhere in this app.
      const binaryString = atob(result.pdf as string);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.fileName || `Invoice-${data?.invoice.invoice_number ?? invoiceId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to download invoice PDF.');
    } finally {
      setDownloading(false);
    }
  };

  const latestQueueRow = data?.queueRows[0] ?? null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{data ? `Invoice ${data.invoice.invoice_number}` : 'Invoice details'}</SheetTitle>
          <SheetDescription>Automatically generated from the report-delivery billing pipeline.</SheetDescription>
        </SheetHeader>

        {loading ? (
          <AdminLoadingState label="Loading invoice…" />
        ) : error ? (
          <AdminErrorState message={error} />
        ) : data ? (
          <div className="mt-4 flex flex-col gap-6 text-sm">
            <section className="flex flex-col gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Invoice</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                <span className="text-slate-500">Status</span>
                <span><AdminPill tone={data.invoice.status === 'active' ? 'success' : 'neutral'}>{data.invoice.status}</AdminPill></span>
                <span className="text-slate-500">Invoice date</span>
                <span>{data.invoice.invoice_date}</span>
                <span className="text-slate-500">Due date</span>
                <span>{data.invoice.due_date || '—'}</span>
                <span className="text-slate-500">Amount (excl. VAT)</span>
                <span>{formatRand(data.invoice.amount)}</span>
                <span className="text-slate-500">VAT</span>
                <span>{formatRand(data.invoice.vat_amount)}</span>
                <span className="text-slate-500 font-medium">Total</span>
                <span className="font-medium">{formatRand(data.invoice.total_amount)}</span>
              </div>
            </section>

            <section className="flex flex-col gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Appointment</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                <span className="text-slate-500">Claimant</span>
                <span>{data.claimantName || '—'}</span>
                <span className="text-slate-500">Referring attorney</span>
                <span>{data.attorneyName || '—'}</span>
                <span className="text-slate-500">Appointment</span>
                <span>{data.appointmentLabel || '—'}</span>
              </div>
            </section>

            <section className="flex flex-col gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Delivery</h4>
              {latestQueueRow ? (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  <span className="text-slate-500">Status</span>
                  <span><AdminPill tone={deliveryStatusTone(latestQueueRow.status)}>{latestQueueRow.status}</AdminPill></span>
                  <span className="text-slate-500">Attempts</span>
                  <span>{latestQueueRow.attempts}</span>
                  {latestQueueRow.last_error && (
                    <>
                      <span className="text-slate-500">Last error</span>
                      <span className="break-words text-destructive">{latestQueueRow.last_error}</span>
                    </>
                  )}
                  <span className="text-slate-500">Queued</span>
                  <span>{formatDateTime(latestQueueRow.created_at)}</span>
                  {latestQueueRow.processed_at && (
                    <>
                      <span className="text-slate-500">Processed</span>
                      <span>{formatDateTime(latestQueueRow.processed_at)}</span>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500">Not yet queued for delivery.</p>
              )}
              {data.queueRows.length > 1 && (
                <p className="text-xs text-slate-400">{data.queueRows.length} delivery attempts on record.</p>
              )}
            </section>

            <section className="flex flex-col gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Invoice email</h4>
              {data.emailLog ? (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  <span className="text-slate-500">Sent</span>
                  <span><AdminPill tone="success">Sent</AdminPill></span>
                  <span className="text-slate-500">Sent at</span>
                  <span>{formatDateTime(data.emailLog.sent_at)}</span>
                  <span className="text-slate-500">Recipient</span>
                  <span className="break-words">{data.emailLog.recipient_email}</span>
                </div>
              ) : (
                <p className="text-xs text-slate-500">No invoice email has been sent yet for this invoice.</p>
              )}
            </section>

            <Button
              onClick={handleDownload}
              disabled={downloading}
              className="gradient-teal rounded-none border text-white"
            >
              {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Download Invoice PDF
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
