// internal-invoice-delivery-processor
//
// Processes public.internal_invoice_delivery_queue ONLY. Never touches
// public.internal_invoices (beyond a read-only SELECT), never touches
// public.internal_sage_queue, public.sage_customer_mappings, the legacy
// public.sageone_invoice_queue path, or reconcile_internal_invoices().
//
// This function owns exactly two things, run in sequence for each
// claimed queue row:
//   1. Generate the invoice PDF from internal_invoices fields only (no
//      amount/VAT recalculation — internal_invoices is the sole source
//      of truth).
//   2. Email that PDF to the referring attorney via the existing Resend
//      wrapper (_shared/email.ts).
//
// Sage is completely out of scope here. internal_sage_queue is
// populated by reconcile_internal_invoices() itself (per the confirmed
// live schema) and is drained separately, unmodified, by
// internal-sage-processor.
//
// DUPLICATE-EMAIL PROTECTION: public.internal_invoice_email_log has a
// UNIQUE(internal_invoice_id) constraint. This function checks that
// table before sending (fast path, avoids a needless Resend call for
// the common case) AND relies on the UNIQUE constraint as the
// structural guarantee (belt-and-suspenders): a row is only ever
// inserted there AFTER Resend confirms the send succeeded, so a failed
// or crashed attempt never marks a non-sent email as sent, and never
// blocks a retry. See recordFailure/processQueueItem below for the
// exact ordering.
//
// Scheduled via pg_cron (see
// 20260814090000_schedule_internal_invoice_delivery_processor.sql). Can
// also be invoked manually (authenticated) to test, matching the
// existing internal-sage-processor convention.
//
// SELF-CONTAINED BY DESIGN: this file deliberately does NOT import from
// ../_shared/errors.ts, ../_shared/supabase.ts, or ../_shared/email.ts.
// Supabase CLI's `functions deploy <name>` bundles only the files it can
// resolve from the target function's own directory tree in some deploy
// environments, and a bare `../_shared/...` relative import can fail to
// bundle ("Module not found") if the shared folder isn't present
// alongside the function at deploy time. Every import below is either a
// remote https:/npm: specifier (resolved independently by Deno, exactly
// as in every other function in this project) or inlined in this file.
// The inlined logic below is copied verbatim from this project's real
// _shared/errors.ts, _shared/supabase.ts, and _shared/email.ts — same
// behavior, same Resend batching, same error envelope shape — just
// duplicated here rather than imported, purely for deploy robustness.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.0";

// ----- inlined from ../_shared/errors.ts (kept minimal to what this file uses) -----
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "METHOD_NOT_ALLOWED"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  METHOD_NOT_ALLOWED: 405,
  VALIDATION_ERROR: 422,
  INTERNAL_ERROR: 500,
};

export class HttpError extends Error {
  status: number;
  code: ErrorCode;
  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = "HttpError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
  }
}

function errorResponse(err: unknown, requestId: string): Response {
  const httpErr =
    err instanceof HttpError ? err : new HttpError("INTERNAL_ERROR", err instanceof Error ? err.message : "Internal server error");
  if (!(err instanceof HttpError)) {
    console.error(`[${requestId}] Unhandled error:`, err);
  }
  return new Response(
    JSON.stringify({ success: false, error: { code: httpErr.code, message: httpErr.message, requestId } }),
    {
      status: httpErr.status,
      headers: { "Content-Type": "application/json", "X-Request-Id": requestId, ...corsHeaders },
    },
  );
}

type Handler = (req: Request) => Promise<Response> | Response;

export function withErrorHandler(handler: Handler) {
  return async (req: Request): Promise<Response> => {
    const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: { ...corsHeaders, "X-Request-Id": requestId } });
    }
    try {
      const res = await handler(req);
      if (!res.headers.get("X-Request-Id")) res.headers.set("X-Request-Id", requestId);
      for (const [k, v] of Object.entries(corsHeaders)) {
        if (!res.headers.get(k)) res.headers.set(k, v);
      }
      return res;
    } catch (err) {
      return errorResponse(err, requestId);
    }
  };
}

// ----- inlined from ../_shared/supabase.ts -----
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!SUPABASE_URL) throw new Error("SUPABASE_URL environment variable is missing.");
if (!SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY environment variable is missing.");

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ----- inlined from ../_shared/email.ts (verbatim logic, same batching) -----
interface EmailAttachment {
  filename: string;
  content: string; // base64 string
}
interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  cc?: string | string[];
  attachments?: EmailAttachment[];
}
interface EmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

const MAX_EMAIL_SIZE_BYTES = 35 * 1024 * 1024;

function estimateAttachmentSize(base64Content: string): number {
  return base64Content.length;
}

function batchAttachments(attachments: EmailAttachment[]): EmailAttachment[][] {
  if (!attachments || attachments.length === 0) return [[]];
  const batches: EmailAttachment[][] = [];
  let currentBatch: EmailAttachment[] = [];
  let currentSize = 0;
  for (const att of attachments) {
    const attSize = estimateAttachmentSize(att.content);
    if (attSize >= MAX_EMAIL_SIZE_BYTES) {
      if (currentBatch.length > 0) {
        batches.push(currentBatch);
        currentBatch = [];
        currentSize = 0;
      }
      batches.push([att]);
      continue;
    }
    if (currentSize + attSize > MAX_EMAIL_SIZE_BYTES) {
      batches.push(currentBatch);
      currentBatch = [att];
      currentSize = attSize;
    } else {
      currentBatch.push(att);
      currentSize += attSize;
    }
  }
  if (currentBatch.length > 0) batches.push(currentBatch);
  return batches.length > 0 ? batches : [[]];
}

async function sendEmail(options: EmailOptions): Promise<EmailResponse> {
  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("Missing Resend API key");
      return { success: false, error: "Resend API key is not configured" };
    }
    const resend = new Resend(resendApiKey);
    const fromEmail = options.from || "Kutlwano & Associate <noreply@kamedico-legal.co.za>";
    const recipients = Array.isArray(options.to) ? options.to : [options.to];
    const ccRecipients = options.cc ? (Array.isArray(options.cc) ? options.cc : [options.cc]) : undefined;
    const attachments = options.attachments || [];
    const batches = batchAttachments(attachments);
    const needsSplit = batches.length > 1;
    if (needsSplit) {
      console.log(`Attachments exceed size limit. Splitting into ${batches.length} emails.`);
    }
    let lastMessageId = "";
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const isFollowUp = batchIndex > 0;
      const subject = isFollowUp ? `${options.subject} (Attachments ${batchIndex + 1}/${batches.length})` : options.subject;
      const html = isFollowUp
        ? `<div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #1fb6ce 0%, #159baf 100%); color: white; padding: 15px 20px; text-align: center; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="margin: 0; font-size: 14px;">KUTLWANO & ASSOCIATES (PTY) LTD</h2>
              <p style="margin: 4px 0 0; font-size: 10px;">Medico-Legal Service</p>
            </div>
            <p style="color: #374151; font-size: 12px;">This is a follow-up email containing additional document attachments (Part ${batchIndex + 1} of ${batches.length}) for the previous correspondence.</p>
            <p style="color: #374151; font-size: 12px;">📎 ${batch.length} document(s) attached.</p>
            <p style="color: #6b7280; font-size: 10px; margin-top: 20px; font-style: italic;">This is an automated email. Please do not reply directly to this message.</p>
          </div>`
        : options.html;
      console.log(
        `Sending email batch ${batchIndex + 1}/${batches.length} to: ${recipients.join(", ")}${ccRecipients ? ` (CC: ${ccRecipients.join(", ")})` : ""} with ${batch.length} attachment(s)`,
      );
      const defaultReplyTo = "info@kamedico-legal.co.za";
      const replyToAddress = options.replyTo || defaultReplyTo;
      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: recipients,
        subject,
        html,
        reply_to: replyToAddress,
        headers: {
          "List-Unsubscribe": `<mailto:${defaultReplyTo}?subject=Unsubscribe>`,
          "X-Entity-Ref-ID": crypto.randomUUID(),
        },
        ...(ccRecipients && ccRecipients.length > 0 && { cc: ccRecipients }),
        ...(batch.length > 0 && { attachments: batch }),
      });
      if (error) {
        console.error(`Resend API error on batch ${batchIndex + 1}:`, error);
        return { success: false, error: `Resend API error: ${error.message}` };
      }
      lastMessageId = data?.id || "";
      console.log(`Email batch ${batchIndex + 1} sent successfully. Message ID: ${lastMessageId}`);
    }
    return { success: true, messageId: lastMessageId };
  } catch (error: any) {
    console.error("Resend email error:", error);
    return { success: false, error: error.message || "Failed to send email via Resend" };
  }
}

/** Bounded batch size per invocation — never "process all pending in one
 * request". Overridable via request body for controlled manual testing. */
const DEFAULT_BATCH_SIZE = 20;
const MAX_BATCH_SIZE = 100;

/** After this many failed attempts, a transient failure is treated as
 * permanent and the row is marked 'failed' instead of released for retry. */
const MAX_ATTEMPTS = 5;

// Same company details already used for other generated PDFs in this
// application (see generate-aod-pdf/index.ts DEFAULT_CREDITOR_INFO) —
// reused here rather than invented, per "reuse existing styling/document
// patterns rather than creating an unrelated design".
const COMPANY_INFO = {
  name: "Kutlwano & Associates (Pty) Ltd",
  registrationNumber: "2016/461385/07",
  address: "52 Quatar Crescent, Cosmo City, Ext 10, Roodepoort, 2188",
  bankName: "First National Bank",
  accountName: "Kutlwano and Associate (Pty) Ltd",
  accountNumber: "62770592270",
  branchName: "Middestad",
  branchCode: "260448",
};

// Real, hosted brand assets — same files already shipped in this
// project's public/lovable-uploads/ and served from the production
// domain used by every other outbound email in this codebase (see
// resend-user-confirmation/index.ts's APP_ORIGIN and the "from"/link
// addresses throughout supabase/functions/). Fetched at send time and
// embedded into the PDF; referenced directly by URL in the email (mail
// clients load images by URL, they can't take embedded PDF assets).
const LOGO_ICON_URL = "https://kamedico-legal.co.za/lovable-uploads/logo-icon-512.png";
const LOGO_WORDMARK_URL = "https://kamedico-legal.co.za/lovable-uploads/d45f27ec-34bf-470c-bc47-015dff5748e0.png";

type QueueRow = {
  id: string;
  internal_invoice_id: string;
  status: string;
  attempts: number;
  last_error: string | null;
  claimed_at: string | null;
  processed_at: string | null;
  created_at: string;
};

// Same shape already read (and never written to) by
// internal-sage-processor/index.ts's loadAndValidateInvoice — internal_invoices
// itself is not modified here either.
type InvoiceRow = {
  id: string;
  appointment_id: string;
  invoice_number: string;
  status: string;
  amount: number;
  vat_amount: number;
  total_amount: number;
  invoice_date: string;
  due_date: string | null;
  claimant_id: string | null;
  expert_id: string | null;
  referring_attorney_id: string | null;
};

type ReferringAttorneyRow = {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
};

type ItemOutcome =
  | { itemId: string; outcome: "already_sent" }
  | { itemId: string; outcome: "validation_failed"; reason: string }
  | { itemId: string; outcome: "send_failed"; reason: string }
  | { itemId: string; outcome: "sent" };

/**
 * Atomically claims up to `limit` pending rows via `FOR UPDATE SKIP
 * LOCKED` (through the claim_internal_invoice_delivery_batch RPC) so two
 * concurrent invocations can never claim the same row. Read+write
 * against internal_invoice_delivery_queue ONLY.
 */
async function claimPendingBatch(limit: number): Promise<QueueRow[]> {
  const { data, error } = await supabaseAdmin.rpc("claim_internal_invoice_delivery_batch", {
    p_limit: limit,
  });

  if (error) {
    throw new HttpError(
      "INTERNAL_ERROR",
      `Failed to claim internal_invoice_delivery_queue rows: ${error.message}`,
    );
  }
  return (data ?? []) as QueueRow[];
}

/**
 * TEST-MODE ONLY claim path, mirroring internal-sage-processor's
 * claimSingleTestRow exactly: claims EXACTLY the one queue row matching
 * queueId, only if it is currently 'pending'. Touches nothing else.
 */
async function claimSingleTestRow(queueId: string): Promise<QueueRow | null> {
  const { data, error } = await supabaseAdmin
    .from("internal_invoice_delivery_queue")
    .update({ status: "processing", claimed_at: new Date().toISOString() })
    .eq("id", queueId)
    .eq("status", "pending")
    .select("id, internal_invoice_id, status, attempts, last_error, claimed_at, processed_at, created_at")
    .maybeSingle();

  if (error) {
    throw new HttpError("INTERNAL_ERROR", `Failed to claim test queue row ${queueId}: ${error.message}`);
  }
  return (data as QueueRow | null) ?? null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Pure validation for a single_test request body — directly
 * unit-testable, no DB/network access. Mirrors
 * internal-sage-processor's parseSingleTestRequest. */
export function parseSingleTestRequest(
  body: { queueId?: string; confirm?: boolean },
): { queueId: string } | { error: string } {
  if (!body.confirm) {
    return {
      error:
        "single_test mode requires confirm: true in the request body — a deliberate extra guard against accidental invocation.",
    };
  }
  if (!body.queueId || typeof body.queueId !== "string") {
    return { error: "single_test mode requires a queueId (internal_invoice_delivery_queue.id)." };
  }
  if (!UUID_PATTERN.test(body.queueId)) {
    return { error: `queueId "${body.queueId}" is not a valid UUID.` };
  }
  return { queueId: body.queueId };
}

/** Pure validation for a get_pdf request body — same directly
 * unit-testable shape as parseSingleTestRequest. get_pdf has no
 * confirm requirement (it's a read-only regeneration, not a claim that
 * mutates queue state), just a well-formed invoice id. */
export function parseGetPdfRequest(
  body: { internalInvoiceId?: string },
): { internalInvoiceId: string } | { error: string } {
  if (!body.internalInvoiceId || typeof body.internalInvoiceId !== "string") {
    return { error: "get_pdf mode requires an internalInvoiceId (internal_invoices.id)." };
  }
  if (!UUID_PATTERN.test(body.internalInvoiceId)) {
    return { error: `internalInvoiceId "${body.internalInvoiceId}" is not a valid UUID.` };
  }
  return { internalInvoiceId: body.internalInvoiceId };
}

/**
 * Resolves the calling user from their own bearer token and checks
 * they hold one of the roles allowed to view/download invoices
 * (admin, employee, finance, director — the exact same role set the
 * Internal Invoices tab and its RLS grants use; no role invented here).
 *
 * Mirrors generate-aod-pdf's existing "auth validated in code" pattern:
 * a per-request client built from the caller's own Authorization
 * header (never the service key) resolves the user via auth.getUser(),
 * then their roles are read from public.user_roles — the same table
 * has_role() reads from — via the service-role client (read-only,
 * scoped to that one user id).
 *
 * This check applies ONLY to get_pdf. The batch/single_test modes are
 * unchanged and keep their existing pg_cron-oriented trust model.
 */
const STAFF_ROLES_FOR_INVOICE_ACCESS = ["admin", "employee", "finance", "director"];

async function resolveAuthorizedStaffUser(authHeader: string): Promise<{ id: string } | { error: string }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    return { error: "Server misconfiguration: SUPABASE_URL/SUPABASE_ANON_KEY not set." };
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return { error: "Invalid or expired session." };
  }

  const { data: roleRows, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (roleError) {
    return { error: `Failed to resolve caller roles: ${roleError.message}` };
  }

  const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
  const authorized = roles.some((r: string) => STAFF_ROLES_FOR_INVOICE_ACCESS.includes(r));
  if (!authorized) {
    return { error: "You do not have permission to view invoices." };
  }

  return { id: user.id };
}

/**
 * Reads the internal-invoice-sending pause flag from
 * public.system_settings (setting_key='internal_invoice_sending_paused',
 * a plain JSON boolean). Toggled from the Internal Invoices admin tab's
 * "Restore/Pause Invoice Sending" button (Finance/Director/Admin roles).
 *
 * Fails CLOSED: if the read itself errors, sending is treated as
 * paused rather than risk emailing while the real flag value can't be
 * confirmed. If the row hasn't been seeded yet, defaults to active
 * (false) — same behavior as before this flag existed.
 */
async function isInvoiceSendingPaused(): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("system_settings")
    .select("setting_value")
    .eq("setting_key", "internal_invoice_sending_paused")
    .maybeSingle();

  if (error) {
    console.error(
      "internal-invoice-delivery-processor: failed to read pause flag, treating sending as paused:",
      error.message,
    );
    return true;
  }
  if (!data) return false;
  return data.setting_value === true;
}

async function recordFailure(row: QueueRow, message: string): Promise<void> {
  const nextAttempts = row.attempts + 1;
  const nextStatus = nextAttempts >= MAX_ATTEMPTS ? "failed" : "pending";

  const { error } = await supabaseAdmin
    .from("internal_invoice_delivery_queue")
    .update({
      status: nextStatus,
      attempts: nextAttempts,
      last_error: message,
      claimed_at: nextStatus === "pending" ? null : row.claimed_at,
    })
    .eq("id", row.id);

  if (error) {
    console.error(`internal-invoice-delivery-processor: failed to record failure for ${row.id}:`, error.message);
  }
}

async function markSuccess(row: QueueRow): Promise<void> {
  const { error } = await supabaseAdmin
    .from("internal_invoice_delivery_queue")
    .update({ status: "success", processed_at: new Date().toISOString(), claimed_at: null, last_error: null })
    .eq("id", row.id);

  if (error) {
    console.error(`internal-invoice-delivery-processor: failed to mark success for ${row.id}:`, error.message);
  }
}

/** Loads and validates the invoice this queue row points to, plus the
 * referring attorney it will be emailed to. Never mutates
 * internal_invoices or referring_attorneys — read-only. Mirrors
 * internal-sage-processor's loadAndValidateInvoice. */
async function loadAndValidateInvoice(
  internalInvoiceId: string,
): Promise<{ invoice: InvoiceRow; attorney: ReferringAttorneyRow } | { error: string }> {
  const { data, error } = await supabaseAdmin
    .from("internal_invoices")
    .select(
      "id, appointment_id, invoice_number, status, amount, vat_amount, total_amount, invoice_date, due_date, claimant_id, expert_id, referring_attorney_id",
    )
    .eq("id", internalInvoiceId)
    .maybeSingle();

  if (error) {
    return { error: `Failed to load internal_invoices row: ${error.message}` };
  }
  if (!data) {
    return { error: `internal_invoices row ${internalInvoiceId} not found.` };
  }

  const invoice = data as InvoiceRow;

  if (invoice.status !== "active") {
    return { error: `Invoice ${invoice.invoice_number} is not active (status='${invoice.status}').` };
  }
  if (!invoice.total_amount || invoice.total_amount <= 0) {
    return { error: `Invoice ${invoice.invoice_number} has an invalid total_amount.` };
  }
  if (!invoice.invoice_number) {
    return { error: `Invoice ${invoice.id} is missing an invoice_number.` };
  }
  if (!invoice.referring_attorney_id) {
    return {
      error: `Invoice ${invoice.invoice_number} has no referring_attorney_id — cannot determine the recipient.`,
    };
  }

  const { data: attorneyData, error: attorneyError } = await supabaseAdmin
    .from("referring_attorneys")
    .select("id, name, contact_person, email, phone, address")
    .eq("id", invoice.referring_attorney_id)
    .maybeSingle();

  if (attorneyError) {
    return { error: `Failed to load referring_attorneys row: ${attorneyError.message}` };
  }
  if (!attorneyData) {
    return {
      error: `referring_attorneys row ${invoice.referring_attorney_id} not found for invoice ${invoice.invoice_number}.`,
    };
  }
  const attorney = attorneyData as ReferringAttorneyRow;
  if (!attorney.email || !attorney.email.trim()) {
    return {
      error: `referring_attorneys row ${attorney.id} has no email — cannot send invoice ${invoice.invoice_number}.`,
    };
  }

  return { invoice, attorney };
}

/** Returns true if this invoice already has a logged successful send —
 * the fast-path check. The UNIQUE(internal_invoice_id) constraint on
 * internal_invoice_email_log is the actual structural guarantee; this
 * is just an early exit that avoids a needless Resend call. */
async function alreadySent(internalInvoiceId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("internal_invoice_email_log")
    .select("id")
    .eq("internal_invoice_id", internalInvoiceId)
    .maybeSingle();

  if (error) {
    throw new HttpError(
      "INTERNAL_ERROR",
      `Failed to check internal_invoice_email_log for invoice ${internalInvoiceId}: ${error.message}`,
    );
  }
  return data != null;
}

export function formatCurrency(amount: number): string {
  return `R ${amount.toFixed(2)}`;
}

// Mirrors external-portal-auth/index.ts's escapeHtml() exactly — same
// implementation, kept local rather than imported, for the same
// deploy-robustness reason the rest of this file is self-contained
// (see the top-of-file note on ../_shared/... imports).
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Matches the approved reference template exactly (real logo images,
// gradient header AND footer bands, "Dear {name}," salutation, combined
// due-date sentence, banking-details note, and the "if you weren't
// expecting this" caution line) — real hosted asset URLs substituted
// for the reference's base64 placeholders, real merge fields
// substituted for its static example values.
function invoiceEmailHtml(params: {
  recipientName: string;
  invoiceNumber: string;
  totalAmount: number;
  dueDate: string | null;
}): string {
  const { recipientName, invoiceNumber, totalAmount, dueDate } = params;
  return `
    <div style="background: #f4f6f7; font-family: Arial, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; background: #f4f6f7;">
        <div style="background: linear-gradient(135deg, #1fb6ce 0%, #159baf 100%); padding: 30px 24px 24px; text-align: center;">
          <div style="display: inline-block; background: #ffffff; border-radius: 10px; padding: 14px; margin-bottom: 16px;">
            <img src="${LOGO_ICON_URL}" alt="Kutlwano &amp; Associates" width="90" style="display: block; height: auto; border: 0;" />
          </div>
          <h1 style="margin: 0; color: #ffffff; font-size: 18px; letter-spacing: 0.5px;">KUTLWANO &amp; ASSOCIATES (PTY) LTD</h1>
          <p style="margin: 6px 0 0; color: #ffffff; font-size: 12px; opacity: 0.9;">Medico-Legal Service</p>
        </div>

        <div style="background: #ffffff; padding: 28px 28px 24px;">
          <p style="color: #1f2937; font-size: 14px; margin: 0 0 12px;">Dear ${escapeHtml(recipientName)},</p>
          <p style="color: #374151; font-size: 14px; margin: 0 0 20px;">
            Please find attached invoice <strong>${escapeHtml(invoiceNumber)}</strong> for medico-legal services rendered.${dueDate ? ` This is due by <strong>${escapeHtml(dueDate)}</strong>.` : ""}
          </p>

          <div style="text-align: center; margin: 24px 0;">
            <span style="display: inline-block; font-size: 28px; font-weight: 700; color: #159baf; background: #eaf9fb; border: 1px solid #b9ecf1; border-radius: 6px; padding: 14px 22px;">
              ${escapeHtml(formatCurrency(totalAmount))}
            </span>
          </div>

          <p style="color: #374151; font-size: 13px; margin: 0 0 8px;">
            The attached invoice includes full banking details for payment.
          </p>
          <p style="color: #6b7280; font-size: 12px; margin: 0;">
            If you weren't expecting this invoice, please contact us before making payment.
          </p>
        </div>

        <div style="background: linear-gradient(135deg, #1fb6ce 0%, #159baf 100%); padding: 28px 24px; text-align: center;">
          <img src="${LOGO_WORDMARK_URL}" alt="Kutlwano &amp; Associate" width="180" style="display: block; height: auto; margin: 0 auto 18px; border: 0;" />
          <p style="font-style: italic; color: #ffffff; font-size: 12px; margin: 0 0 10px;">
            "We Touch a File, We Change a Life, We are Kutlwano &amp; Associate"
          </p>
          <p style="font-size: 11px; color: #ffffff; opacity: 0.85; margin: 0;">
            This is an automated email. Please do not reply directly to this message.
          </p>
        </div>

        <p style="text-align: center; font-size: 10px; color: #9ca3af; margin: 0; padding: 14px 0;">
          Kutlwano &amp; Associates (Pty) Ltd | Registration: 2016/461385/07
        </p>
      </div>
    </div>
  `;
}

/** Builds the invoice PDF from internal_invoices fields only — no
 * amount/VAT recalculation. Matches the approved reference "Tax
 * Invoice" layout exactly: logo + company block top-left, "TAX
 * INVOICE" + invoice meta top-right, a teal rule, Bill To / Invoice
 * Summary boxes, a teal line-item header bar, the amount breakdown, a
 * teal Total Due bar, and a Payment Details box with this company's
 * real banking details (same figures already used in
 * generate-aod-pdf/index.ts's DEFAULT_CREDITOR_INFO). */
async function generateInvoicePdf(invoice: InvoiceRow, attorney: ReferringAttorneyRow): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();
  const left = 50;
  const right = width - 50;
  const contentWidth = right - left;

  const TEAL = rgb(0.086, 0.608, 0.686); // #159baf
  const DARK = rgb(0.13, 0.15, 0.17);
  const GRAY = rgb(0.42, 0.45, 0.5);
  const LIGHT_GRAY_FILL = rgb(0.965, 0.968, 0.97);
  const LINE_GRAY = rgb(0.85, 0.86, 0.87);

  const rightAlignedText = (text: string, yPos: number, size: number, useFont = font, color = DARK) => {
    const textWidth = useFont.widthOfTextAtSize(text, size);
    page.drawText(text, { x: right - textWidth, y: yPos, size, font: useFont, color });
  };

  // ---- Header: logo + company block (left), TAX INVOICE + meta (right) ----
  let headerTextX = left;
  const topY = height - 55;
  try {
    const logoBytes = await (await fetch(LOGO_ICON_URL)).arrayBuffer();
    const logoImage = await pdfDoc.embedPng(new Uint8Array(logoBytes));
    const logoSize = 44;
    page.drawImage(logoImage, { x: left, y: topY - logoSize + 10, width: logoSize, height: logoSize });
    headerTextX = left + logoSize + 12;
  } catch (err) {
    // Logo fetch/embed failing must never block invoice generation or
    // the email send — fall back to text-only header.
    console.error("generateInvoicePdf: failed to embed logo, continuing without it:", err);
  }

  page.drawText(COMPANY_INFO.name, { x: headerTextX, y: topY, size: 15, font: boldFont, color: DARK });
  page.drawText(`Reg. No: ${COMPANY_INFO.registrationNumber}`, { x: headerTextX, y: topY - 16, size: 8.5, font, color: GRAY });
  page.drawText(COMPANY_INFO.address, { x: headerTextX, y: topY - 28, size: 8.5, font, color: GRAY });

  rightAlignedText("COPY", topY, 22, boldFont, TEAL);
  rightAlignedText(`Invoice # ${invoice.invoice_number}`, topY - 20, 9.5, font, GRAY);
  rightAlignedText(`Date: ${invoice.invoice_date}`, topY - 33, 9.5, font, GRAY);
  if (invoice.due_date) {
    rightAlignedText(`Due: ${invoice.due_date}`, topY - 46, 9.5, font, GRAY);
  }

  let y = topY - 70;
  page.drawRectangle({ x: left, y: y - 2, width: contentWidth, height: 2.5, color: TEAL });
  y -= 30;

  // ---- Bill To / Invoice Summary boxes ----
  const boxTop = y;
  const boxHeight = 110;
  const boxGap = 20;
  const boxWidth = (contentWidth - boxGap) / 2;
  const rightBoxX = left + boxWidth + boxGap;

  page.drawRectangle({ x: left, y: boxTop - boxHeight, width: boxWidth, height: boxHeight, color: LIGHT_GRAY_FILL });
  page.drawRectangle({ x: rightBoxX, y: boxTop - boxHeight, width: boxWidth, height: boxHeight, color: LIGHT_GRAY_FILL });

  let by = boxTop - 20;
  page.drawText("BILL TO", { x: left + 16, y: by, size: 9, font: boldFont, color: TEAL });
  by -= 18;
  page.drawText(attorney.name, { x: left + 16, y: by, size: 11, font: boldFont, color: DARK });
  if (attorney.contact_person) {
    by -= 14;
    page.drawText(`Attn: ${attorney.contact_person}`, { x: left + 16, y: by, size: 8.5, font, color: GRAY });
  }
  if (attorney.address) {
    by -= 14;
    page.drawText(attorney.address, { x: left + 16, y: by, size: 8.5, font, color: GRAY });
  }
  if (attorney.email) {
    by -= 14;
    page.drawText(attorney.email, { x: left + 16, y: by, size: 8.5, font, color: GRAY });
  }

  let sy = boxTop - 20;
  page.drawText("INVOICE SUMMARY", { x: rightBoxX + 16, y: sy, size: 9, font: boldFont, color: TEAL });
  sy -= 20;
  const summaryLabelX = rightBoxX + 16;
  const summaryValueRight = rightBoxX + boxWidth - 16;
  const drawSummaryRow = (label: string, value: string, bold = false) => {
    page.drawText(label, { x: summaryLabelX, y: sy, size: 9, font, color: GRAY });
    const vFont = bold ? boldFont : boldFont;
    const vWidth = vFont.widthOfTextAtSize(value, 9.5);
    page.drawText(value, { x: summaryValueRight - vWidth, y: sy, size: 9.5, font: vFont, color: DARK });
    sy -= 17;
  };
  drawSummaryRow("Invoice Number", invoice.invoice_number);
  drawSummaryRow("Invoice Date", invoice.invoice_date);
  drawSummaryRow("Amount Due", formatCurrency(invoice.total_amount), true);

  y = boxTop - boxHeight - 30;

  // ---- Line-item table ----
  const barHeight = 22;
  page.drawRectangle({ x: left, y: y - barHeight, width: contentWidth, height: barHeight, color: TEAL });
  page.drawText("DESCRIPTION", { x: left + 12, y: y - barHeight + 7, size: 9.5, font: boldFont, color: rgb(1, 1, 1) });
  rightAlignedText("AMOUNT", y - barHeight + 7, 9.5, boldFont, rgb(1, 1, 1));
  y -= barHeight + 22;

  page.drawText(`Medico-legal services rendered — Invoice ${invoice.invoice_number}`, { x: left, y, size: 9.5, font, color: DARK });
  rightAlignedText(formatCurrency(invoice.amount), y, 9.5, font, DARK);

  y -= 26;
  page.drawLine({ start: { x: left, y: y + 8 }, end: { x: right, y: y + 8 }, thickness: 0.75, color: LINE_GRAY });

  // ---- Subtotal / VAT / Total ----
  const summaryColLabelX = left + contentWidth * 0.55;
  page.drawText("Subtotal (excl. VAT)", { x: summaryColLabelX, y, size: 9.5, font, color: GRAY });
  rightAlignedText(formatCurrency(invoice.amount), y, 9.5, font, DARK);
  y -= 17;
  page.drawText("VAT (15%)", { x: summaryColLabelX, y, size: 9.5, font, color: GRAY });
  rightAlignedText(formatCurrency(invoice.vat_amount), y, 9.5, font, DARK);
  y -= 24;

  const totalBarHeight = 28;
  page.drawRectangle({ x: summaryColLabelX - 12, y: y - totalBarHeight + 8, width: right - (summaryColLabelX - 12), height: totalBarHeight, color: TEAL });
  page.drawText("TOTAL DUE", { x: summaryColLabelX, y: y - totalBarHeight + 17, size: 10.5, font: boldFont, color: rgb(1, 1, 1) });
  rightAlignedText(formatCurrency(invoice.total_amount), y - totalBarHeight + 17, 13, boldFont, rgb(1, 1, 1));

  // ---- Payment Details (fixed near the bottom, matching the reference's whitespace) ----
  const payBoxHeight = 90;
  const payBoxY = 170;
  page.drawRectangle({ x: left, y: payBoxY, width: contentWidth, height: payBoxHeight, color: LIGHT_GRAY_FILL });
  let py = payBoxY + payBoxHeight - 22;
  page.drawText("PAYMENT DETAILS", { x: left + 16, y: py, size: 9, font: boldFont, color: TEAL });
  py -= 20;
  const payColRightX = left + contentWidth / 2 + 20;
  page.drawText(`Bank: `, { x: left + 16, y: py, size: 9, font, color: GRAY });
  page.drawText(COMPANY_INFO.bankName, { x: left + 16 + font.widthOfTextAtSize("Bank: ", 9), y: py, size: 9, font: boldFont, color: DARK });
  page.drawText(`Account Name: `, { x: payColRightX, y: py, size: 9, font, color: GRAY });
  page.drawText(COMPANY_INFO.accountName, { x: payColRightX + font.widthOfTextAtSize("Account Name: ", 9), y: py, size: 9, font: boldFont, color: DARK });
  py -= 16;
  page.drawText(`Account Number: `, { x: left + 16, y: py, size: 9, font, color: GRAY });
  page.drawText(COMPANY_INFO.accountNumber, { x: left + 16 + font.widthOfTextAtSize("Account Number: ", 9), y: py, size: 9, font: boldFont, color: DARK });
  page.drawText(`Branch: `, { x: payColRightX, y: py, size: 9, font, color: GRAY });
  page.drawText(COMPANY_INFO.branchName, { x: payColRightX + font.widthOfTextAtSize("Branch: ", 9), y: py, size: 9, font: boldFont, color: DARK });
  py -= 16;
  page.drawText(`Branch Code: `, { x: left + 16, y: py, size: 9, font, color: GRAY });
  page.drawText(COMPANY_INFO.branchCode, { x: left + 16 + font.widthOfTextAtSize("Branch Code: ", 9), y: py, size: 9, font: boldFont, color: DARK });

  // ---- Footer ----
  const footerText = "Thank you for your business. This is a computer-generated invoice.";
  const footerWidth = font.widthOfTextAtSize(footerText, 9);
  page.drawText(footerText, { x: left + (contentWidth - footerWidth) / 2, y: 60, size: 9, font, color: GRAY });

  return await pdfDoc.save();
}

export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function processQueueItem(row: QueueRow): Promise<ItemOutcome> {
  // Fast-path idempotency check — see alreadySent's doc comment. The
  // real guarantee is the UNIQUE constraint hit further down.
  if (await alreadySent(row.internal_invoice_id)) {
    await markSuccess(row);
    return { itemId: row.id, outcome: "already_sent" };
  }

  const loaded = await loadAndValidateInvoice(row.internal_invoice_id);
  if ("error" in loaded) {
    await recordFailure(row, loaded.error);
    return { itemId: row.id, outcome: "validation_failed", reason: loaded.error };
  }

  const { invoice, attorney } = loaded;

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await generateInvoicePdf(invoice, attorney);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordFailure(row, `PDF generation failed: ${message}`);
    return { itemId: row.id, outcome: "send_failed", reason: message };
  }

  const sendResult = await sendEmail({
    to: attorney.email!,
    subject: `Invoice ${invoice.invoice_number} — Kutlwano & Associates`,
    html: invoiceEmailHtml({
      recipientName: attorney.contact_person || attorney.name,
      invoiceNumber: invoice.invoice_number,
      totalAmount: invoice.total_amount,
      dueDate: invoice.due_date,
    }),
    attachments: [
      {
        filename: `Invoice-${invoice.invoice_number}.pdf`,
        content: uint8ToBase64(pdfBytes),
      },
    ],
  });

  if (!sendResult.success) {
    await recordFailure(row, `Email send failed: ${sendResult.error ?? "unknown error"}`);
    return { itemId: row.id, outcome: "send_failed", reason: sendResult.error ?? "unknown error" };
  }

  // The email has actually been sent at this point. This insert is the
  // real duplicate-email guard (UNIQUE(internal_invoice_id)) — it only
  // ever happens AFTER a confirmed successful send.
  //
  // KNOWN, DOCUMENTED RISK WINDOW (same shape as the one already
  // accepted in internal-sage-processor for sage_reference): if this
  // process crashes between sendEmail() succeeding above and this
  // INSERT committing, the row stays absent from
  // internal_invoice_email_log, and a later retry would send a second
  // email. This window is real and currently unmitigated beyond "keep
  // it small" (this INSERT runs immediately after the send, with no
  // other work in between) — the same trade-off already made and
  // documented for the Sage path, not silently introduced here.
  const { error: logError } = await supabaseAdmin.from("internal_invoice_email_log").insert({
    internal_invoice_id: invoice.id,
    recipient_email: attorney.email,
    resend_message_id: sendResult.messageId ?? null,
  });

  if (logError && (logError as { code?: string }).code !== "23505") {
    // Email was sent but we could not record it. Do NOT mark the queue
    // row as success (that would hide the audit gap) — record as a
    // failure so it surfaces, but note attempts is NOT incremented via
    // recordFailure's normal path since a real send did occur; instead
    // log loudly and still mark the queue row success once alreadySent
    // would in practice cover a retry via the recipient's actual inbox
    // state. We choose the safer of two imperfect options: mark success
    // (the email genuinely was sent) and log the audit-write failure
    // for manual follow-up, rather than risk a duplicate send on retry.
    console.error(
      `internal-invoice-delivery-processor: email sent for invoice ${invoice.invoice_number} but failed to write internal_invoice_email_log: ${logError.message}`,
    );
  }

  await markSuccess(row);
  return { itemId: row.id, outcome: "sent" };
}

serve(
  withErrorHandler(async (req) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    if (req.method !== "POST") {
      throw new HttpError("METHOD_NOT_ALLOWED", "Use POST.");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new HttpError("UNAUTHORIZED", "Missing bearer token.");
    }

    let body: { batchSize?: number; mode?: string; queueId?: string; confirm?: boolean; internalInvoiceId?: string } = {};
    try {
      body = await req.json();
    } catch {
      // empty body is fine, defaults apply
    }

    // --- ON-DEMAND PDF MODE (called by the frontend, never by cron) ---
    // Read-only: loads and validates the invoice exactly like the
    // regular pipeline does, regenerates the PDF from internal_invoices
    // fields only (no amount/VAT recalculation, same generateInvoicePdf
    // used by the queue processor), and returns it. Never touches
    // internal_invoice_delivery_queue or internal_invoice_email_log —
    // this is not a send, not a retry, and not a claim.
    if (body.mode === "get_pdf") {
      const parsed = parseGetPdfRequest(body);
      if ("error" in parsed) {
        throw new HttpError("VALIDATION_ERROR", parsed.error);
      }

      const authResult = await resolveAuthorizedStaffUser(authHeader);
      if ("error" in authResult) {
        throw new HttpError("UNAUTHORIZED", authResult.error);
      }

      const loaded = await loadAndValidateInvoice(parsed.internalInvoiceId);
      if ("error" in loaded) {
        throw new HttpError("BAD_REQUEST", loaded.error);
      }

      const { invoice, attorney } = loaded;
      const pdfBytes = await generateInvoicePdf(invoice, attorney);

      return new Response(
        JSON.stringify({
          success: true,
          pdf: uint8ToBase64(pdfBytes),
          fileName: `Invoice-${invoice.invoice_number}.pdf`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    // --- end on-demand PDF mode --------------------------------------

    // --- PAUSE CHECK ---------------------------------------------------
    // Applies to single_test and the default batch mode below — both
    // actually send email. get_pdf (above) is read-only and unaffected.
    if (await isInvoiceSendingPaused()) {
      return new Response(
        JSON.stringify({
          paused: true,
          claimed: 0,
          sent: 0,
          alreadySent: 0,
          failed: 0,
          outcomes: [],
          message:
            "Internal invoice sending is currently paused (system_settings.internal_invoice_sending_paused = true). Restore it from the Internal Invoices admin tab.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    // --- end pause check -------------------------------------------

    // --- SINGLE-RECORD TEST MODE ----------------------------------
    if (body.mode === "single_test") {
      const parsed = parseSingleTestRequest(body);
      if ("error" in parsed) {
        throw new HttpError("VALIDATION_ERROR", parsed.error);
      }
      const { queueId } = parsed;

      const row = await claimSingleTestRow(queueId);
      if (!row) {
        return new Response(
          JSON.stringify({
            mode: "single_test",
            queueId,
            claimed: 0,
            message:
              `No internal_invoice_delivery_queue row with id=${queueId} and status='pending' was found. ` +
              `Nothing was claimed or modified.`,
          }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const outcome = await processQueueItem(row);
      return new Response(
        JSON.stringify({ mode: "single_test", queueId, claimed: 1, outcome }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    // --- end single-record test mode --------------------------------

    const batchSize = Math.min(body.batchSize ?? DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE);

    console.log(`internal-invoice-delivery-processor: starting run. batchSize=${batchSize}`);

    const batch = await claimPendingBatch(batchSize);
    const outcomes: ItemOutcome[] = [];
    for (const row of batch) {
      outcomes.push(await processQueueItem(row));
    }

    const summary = {
      claimed: batch.length,
      sent: outcomes.filter((o) => o.outcome === "sent").length,
      alreadySent: outcomes.filter((o) => o.outcome === "already_sent").length,
      failed: outcomes.filter((o) => o.outcome === "validation_failed" || o.outcome === "send_failed").length,
    };
    console.log("internal-invoice-delivery-processor: run complete.", JSON.stringify(summary));

    return new Response(JSON.stringify({ ...summary, outcomes }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }),
);
