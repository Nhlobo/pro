// internal-sage-processor
//
// Processes public.internal_sage_queue ONLY. Never touches the legacy
// public.sageone_invoice_queue, its trigger, or its function.
//
// STATUS: Sage submission is structurally disabled — see
// _shared/sageone-client.ts. This function claims queue rows, loads and
// validates the linked internal_invoices row, and — while Sage remains
// unconfigured — releases the claim without ever attempting an external
// call and without marking anything permanently failed. It makes ZERO
// external HTTP requests and ZERO financial mutations.
//
// Not wired to pg_cron yet. Invoke manually (authenticated) to test.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, withErrorHandler, HttpError } from "../_shared/errors.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import {
  getSageOneClient,
  SageOperationError,
  type SageErrorCategory,
} from "../_shared/sageone-client.ts";

/** Bounded batch size per invocation — never "process all pending in one
 * request". Overridable via request body for controlled manual testing. */
const DEFAULT_BATCH_SIZE = 20;
const MAX_BATCH_SIZE = 100;

/** After this many failed attempts, a transient failure is treated as
 * permanent and the row is marked 'failed' instead of released for retry. */
const MAX_ATTEMPTS = 5;

type QueueRow = {
  id: string;
  internal_invoice_id: string;
  status: string;
  attempts: number;
  last_error: string | null;
  sage_reference: string | null;
  claimed_at: string | null;
  processed_at: string | null;
  created_at: string;
};

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

type ItemOutcome =
  | { itemId: string; outcome: "skipped_disabled"; reason: string }
  | { itemId: string; outcome: "validation_failed"; reason: string }
  | { itemId: string; outcome: "would_succeed_but_disabled" };

/**
 * Atomically claims up to `limit` pending rows. Uses `FOR UPDATE SKIP
 * LOCKED` so two concurrent invocations of this function can never claim
 * the same row — the core concurrency-safety requirement. This is a
 * read+write against internal_sage_queue ONLY.
 */
async function claimPendingBatch(limit: number): Promise<QueueRow[]> {
  const { data, error } = await supabaseAdmin.rpc("claim_internal_sage_queue_batch", {
    p_limit: limit,
  });

  if (error) {
    throw new HttpError("INTERNAL_ERROR", `Failed to claim internal_sage_queue rows: ${error.message}`);
  }
  return (data ?? []) as QueueRow[];
}

/** Releases a claimed row back to 'pending' without counting it as a
 * failed attempt — used only for the "Sage disabled" case, per the
 * requirement that disabled-integration runs must never burn attempts
 * or permanently fail records. */
async function releaseWithoutPenalty(queueId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("internal_sage_queue")
    .update({ status: "pending", claimed_at: null })
    .eq("id", queueId)
    .eq("status", "processing");

  if (error) {
    console.error(`internal-sage-processor: failed to release queue item ${queueId}:`, error.message);
  }
}

export function classifyError(err: unknown): { category: SageErrorCategory; message: string; retryable: boolean } {
  if (err instanceof SageOperationError) {
    return { category: err.category, message: err.message, retryable: err.retryable };
  }
  return {
    category: "TRANSIENT_UPSTREAM_ERROR",
    message: err instanceof Error ? err.message : String(err),
    retryable: true,
  };
}

async function recordFailure(row: QueueRow, message: string, retryable: boolean): Promise<void> {
  const nextAttempts = row.attempts + 1;
  const willExhaustRetries = nextAttempts >= MAX_ATTEMPTS;
  const nextStatus = retryable && !willExhaustRetries ? "pending" : "failed";

  const { error } = await supabaseAdmin
    .from("internal_sage_queue")
    .update({
      status: nextStatus,
      attempts: nextAttempts,
      last_error: message,
      claimed_at: nextStatus === "pending" ? null : row.claimed_at,
    })
    .eq("id", row.id);

  if (error) {
    console.error(`internal-sage-processor: failed to record failure for ${row.id}:`, error.message);
  }
}

/** Loads and validates the invoice this queue row points to. Never
 * mutates internal_invoices — read-only. */
async function loadAndValidateInvoice(
  internalInvoiceId: string,
): Promise<{ invoice: InvoiceRow } | { error: string }> {
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
  if (!invoice.appointment_id) {
    return { error: `Invoice ${invoice.id} is missing appointment_id.` };
  }

  return { invoice };
}

async function processQueueItem(row: QueueRow, sage: ReturnType<typeof getSageOneClient>): Promise<ItemOutcome> {
  // Idempotency guard: a row that already has a sage_reference must never
  // be resubmitted, regardless of how it got claimed.
  if (row.sage_reference) {
    await supabaseAdmin
      .from("internal_sage_queue")
      .update({ status: "processed", processed_at: new Date().toISOString(), claimed_at: null })
      .eq("id", row.id);
    return { itemId: row.id, outcome: "would_succeed_but_disabled" };
  }

  const loaded = await loadAndValidateInvoice(row.internal_invoice_id);
  if ("error" in loaded) {
    await recordFailure(row, loaded.error, false);
    return { itemId: row.id, outcome: "validation_failed", reason: loaded.error };
  }

  if (!sage.isConfigured) {
    // Not a failure. Release the claim, touch nothing else. The 458
    // pre-existing records (and any new ones) remain 'pending' exactly
    // as required until the real integration is explicitly enabled.
    await releaseWithoutPenalty(row.id);
    return { itemId: row.id, outcome: "skipped_disabled", reason: sage.configurationStatus };
  }

  // Unreachable today: getSageOneClient() only ever returns a disabled
  // client. Kept here so the real flow is fully wired for when a live
  // client implementation lands — only sageone-client.ts changes then.
  try {
    await sage.authenticate();
    const customer = await sage.findOrCreateCustomer({
      referringAttorneyId: loaded.invoice.referring_attorney_id ?? "",
      name: "", // populated once customer-mapping source is confirmed
    });
    const result = await sage.createInvoice({
      internalInvoiceId: loaded.invoice.id,
      invoiceNumber: loaded.invoice.invoice_number,
      invoiceDate: loaded.invoice.invoice_date,
      dueDate: loaded.invoice.due_date,
      customer,
      lines: [{ description: `Invoice ${loaded.invoice.invoice_number}`, amountExclVat: loaded.invoice.amount }],
      vatAmount: loaded.invoice.vat_amount,
      totalAmount: loaded.invoice.total_amount,
    });

    await supabaseAdmin
      .from("internal_sage_queue")
      .update({
        status: "processed",
        sage_reference: result.sageReference,
        processed_at: new Date().toISOString(),
        claimed_at: null,
        last_error: null,
      })
      .eq("id", row.id);

    return { itemId: row.id, outcome: "would_succeed_but_disabled" };
  } catch (err) {
    const { category, message, retryable } = classifyError(err);
    if (category === "DUPLICATE_INVOICE") {
      // Sage already has it — treat as success, never create a second one.
      await supabaseAdmin
        .from("internal_sage_queue")
        .update({ status: "processed", processed_at: new Date().toISOString(), claimed_at: null, last_error: null })
        .eq("id", row.id);
      return { itemId: row.id, outcome: "would_succeed_but_disabled" };
    }
    await recordFailure(row, `[${category}] ${message}`, retryable);
    return { itemId: row.id, outcome: "validation_failed", reason: message };
  }
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

    let body: { batchSize?: number } = {};
    try {
      body = await req.json();
    } catch {
      // empty body is fine, defaults apply
    }
    const batchSize = Math.min(body.batchSize ?? DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE);

    const sage = getSageOneClient();
    console.log(
      `internal-sage-processor: starting run. sage.isConfigured=${sage.isConfigured} status="${sage.configurationStatus}" batchSize=${batchSize}`,
    );

    // If Sage isn't configured, don't even claim rows — leave the queue
    // completely untouched rather than claim-then-immediately-release.
    if (!sage.isConfigured) {
      return new Response(
        JSON.stringify({
          sageConfigured: false,
          configurationStatus: sage.configurationStatus,
          claimed: 0,
          processed: 0,
          failed: 0,
          skippedDisabled: 0,
          message: "SageOne integration is disabled. No queue rows were claimed or modified.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const batch = await claimPendingBatch(batchSize);
    const outcomes: ItemOutcome[] = [];
    for (const row of batch) {
      outcomes.push(await processQueueItem(row, sage));
    }

    const summary = {
      sageConfigured: sage.isConfigured,
      claimed: batch.length,
      processed: outcomes.filter((o) => o.outcome === "would_succeed_but_disabled").length,
      failed: outcomes.filter((o) => o.outcome === "validation_failed").length,
      skippedDisabled: outcomes.filter((o) => o.outcome === "skipped_disabled").length,
    };
    console.log("internal-sage-processor: run complete.", JSON.stringify(summary));

    return new Response(JSON.stringify({ ...summary, outcomes }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }),
);
