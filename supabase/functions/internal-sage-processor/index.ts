// internal-sage-processor
//
// Processes public.internal_sage_queue ONLY. Never touches the legacy
// public.sageone_invoice_queue, its trigger, or its function.
//
// STATUS: the real Sage HTTP client structure now exists
// (_shared/sageone-client.ts), but this function only ever reaches it
// when getSageOneClient().isConfigured is true, which requires
// SAGEONE_ENABLED=true AND every required credential/config value to
// be present. In the current/default deployment SAGEONE_ENABLED is
// unset, so `sage.isConfigured` is false, no queue rows are claimed,
// no HTTP request is made, and no database state changes. No sandbox
// Sage company has been tested against as of this change — do not
// enable outside a controlled test. See
// SAGE_API_RESEARCH.md for the verified API contract and open items.
//
// SINGLE-RECORD TEST MODE: POSTing { mode: "single_test", queueId,
// confirm: true } claims and processes EXACTLY the one
// internal_sage_queue row identified by queueId — never a batch. This
// exists so a controlled sandbox test can submit ONE invoice without
// running claim_internal_sage_queue_batch (which needs the still-
// unapplied DRAFT migration) and without any risk of touching the rest
// of the queue. See SAGE_API_RESEARCH.md / SANDBOX_TEST.md for the full
// manual procedure. Normal batch behavior (the default, body-less
// invocation) is completely unchanged by this addition.
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

/** The Sage "customer" for an internal invoice is the referring
 * attorney (law firm), not the claimant. Columns confirmed against
 * src/integrations/supabase/types.ts — referring_attorneys has no VAT
 * number, business registration number, or structured multi-line
 * address, so those Sage Customer fields are always left unset rather
 * than invented (see SAGE_API_RESEARCH.md, section 6). */
type ReferringAttorneyRow = {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
};

type ItemOutcome =
  | { itemId: string; outcome: "skipped_disabled"; reason: string }
  | { itemId: string; outcome: "validation_failed"; reason: string }
  | { itemId: string; outcome: "processed" };

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

/**
 * TEST-MODE ONLY claim path. Claims EXACTLY the one internal_sage_queue
 * row matching `queueId`, and only if it is currently 'pending' — the
 * `.eq("id", queueId)` makes it structurally impossible for this to
 * affect any other row, with or without concurrent invocations. Unlike
 * claimPendingBatch, this does NOT call the claim_internal_sage_queue_batch
 * RPC (which needs the still-unapplied DRAFT migration) — it uses a
 * plain, narrowly-scoped UPDATE, matching the pattern already used by
 * releaseWithoutPenalty below. Returns null (touching nothing) if the
 * row doesn't exist or isn't 'pending'.
 */
async function claimSingleTestRow(queueId: string): Promise<QueueRow | null> {
  const { data, error } = await supabaseAdmin
    .from("internal_sage_queue")
    .update({ status: "processing", claimed_at: new Date().toISOString() })
    .eq("id", queueId)
    .eq("status", "pending")
    .select("id, internal_invoice_id, status, attempts, last_error, sage_reference, claimed_at, processed_at, created_at")
    .maybeSingle();

  if (error) {
    throw new HttpError("INTERNAL_ERROR", `Failed to claim test queue row ${queueId}: ${error.message}`);
  }
  return (data as QueueRow | null) ?? null;
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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Pure validation for a single_test request body — no DB/network access,
 * so this is directly unit-testable (see index.test.ts). Mirrors exactly
 * what the handler below requires: mode === "single_test" is the caller's
 * responsibility to check first; this validates the rest.
 */
export function parseSingleTestRequest(
  body: { queueId?: string; confirm?: boolean },
): { queueId: string } | { error: string } {
  if (!body.confirm) {
    return {
      error:
        "single_test mode requires confirm: true in the request body — this is a deliberate extra guard against accidental invocation.",
    };
  }
  if (!body.queueId || typeof body.queueId !== "string") {
    return { error: "single_test mode requires a queueId (internal_sage_queue.id)." };
  }
  if (!UUID_PATTERN.test(body.queueId)) {
    return { error: `queueId "${body.queueId}" is not a valid UUID.` };
  }
  return { queueId: body.queueId };
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

/** Loads and validates the invoice this queue row points to, plus the
 * referring attorney it will be invoiced to in Sage. Never mutates
 * internal_invoices or referring_attorneys — read-only. */
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
  if (!invoice.appointment_id) {
    return { error: `Invoice ${invoice.id} is missing appointment_id.` };
  }
  if (!invoice.referring_attorney_id) {
    return {
      error: `Invoice ${invoice.invoice_number} has no referring_attorney_id — cannot determine the Sage customer.`,
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
  if (!attorney.name || !attorney.name.trim()) {
    return {
      error: `referring_attorneys row ${attorney.id} has no name — Sage requires Customer.Name and none is available.`,
    };
  }

  return { invoice, attorney };
}

async function processQueueItem(row: QueueRow, sage: ReturnType<typeof getSageOneClient>): Promise<ItemOutcome> {
  // Idempotency guard: a row that already has a sage_reference must never
  // be resubmitted, regardless of how it got claimed. This is OUR side
  // of duplicate protection — Sage itself does not offer a confirmed
  // dedupe mechanism (see SAGE_API_RESEARCH.md). The remaining risk
  // window is documented at the sage_reference write below.
  if (row.sage_reference) {
    await supabaseAdmin
      .from("internal_sage_queue")
      .update({ status: "processed", processed_at: new Date().toISOString(), claimed_at: null })
      .eq("id", row.id);
    return { itemId: row.id, outcome: "processed" };
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

  // Reachable ONLY when SAGEONE_ENABLED=true and every required config
  // value is present (see getSageOneClient in _shared/sageone-client.ts).
  // In the default/current deployment this branch never runs — the
  // isConfigured check above always short-circuits first.
  try {
    await sage.authenticate();
    const customer = await sage.findOrCreateCustomer({
      referringAttorneyId: loaded.attorney.id,
      name: loaded.attorney.name,
      contactName: loaded.attorney.contact_person,
      email: loaded.attorney.email,
      telephone: loaded.attorney.phone,
      addressLine1: loaded.attorney.address,
      // No VAT/tax-registration-number column exists on
      // referring_attorneys today — deliberately left unset rather than
      // invented. See SAGE_API_RESEARCH.md, section 6.
      taxReference: null,
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

    // KNOWN DUPLICATE-RISK WINDOW (documented, not solved): if the
    // process crashes/is killed between Sage accepting the
    // TaxInvoice/Save call above and this UPDATE committing, this row
    // stays 'processing' with no sage_reference. A later run will treat
    // it as never-submitted and call Sage again, creating a second
    // invoice — Sage's API confirms no idempotency key / dedupe support
    // (see SAGE_API_RESEARCH.md, item 1). Given the API's documented
    // inability to filter Get queries by string fields, we also cannot
    // reliably ask Sage "does an invoice with ExternalReference=X
    // already exist?" as a pre-check. This window is real and currently
    // unmitigated beyond "keep it small" (this UPDATE runs immediately
    // after the Sage response, with no other work in between). Resolving
    // it fully would need either a Sage-side idempotency mechanism that
    // isn't documented to exist, or a local pre-commit write before the
    // Sage call (which trades this risk for a different one: marking a
    // row as submitted before confirming Sage actually received it).
    // Left as an explicit item for the controlled sandbox test rather
    // than guessed at here.
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

    return { itemId: row.id, outcome: "processed" };
  } catch (err) {
    const { category, message, retryable } = classifyError(err);
    if (category === "DUPLICATE_INVOICE") {
      // Sage already has it — treat as success, never create a second one.
      await supabaseAdmin
        .from("internal_sage_queue")
        .update({ status: "processed", processed_at: new Date().toISOString(), claimed_at: null, last_error: null })
        .eq("id", row.id);
      return { itemId: row.id, outcome: "processed" };
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

    let body: { batchSize?: number; mode?: string; queueId?: string; confirm?: boolean } = {};
    try {
      body = await req.json();
    } catch {
      // empty body is fine, defaults apply
    }

    const sage = getSageOneClient();

    // --- SINGLE-RECORD TEST MODE ---------------------------------------
    // Only entered when the caller explicitly opts in with all three of
    // mode, queueId, and confirm. Any normal/default invocation (no body,
    // or just { batchSize }) falls straight through to the unchanged
    // batch path below and can never hit this branch.
    if (body.mode === "single_test") {
      const parsed = parseSingleTestRequest(body);
      if ("error" in parsed) {
        throw new HttpError("VALIDATION_ERROR", parsed.error);
      }
      const { queueId } = parsed;

      console.log(
        `internal-sage-processor: SINGLE_TEST mode. queueId=${queueId} sage.isConfigured=${sage.isConfigured} status="${sage.configurationStatus}"`,
      );

      const row = await claimSingleTestRow(queueId);
      if (!row) {
        return new Response(
          JSON.stringify({
            mode: "single_test",
            queueId,
            claimed: 0,
            message:
              `No internal_sage_queue row with id=${queueId} and status='pending' was found. ` +
              `Nothing was claimed or modified.`,
          }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const outcome = await processQueueItem(row, sage);
      return new Response(
        JSON.stringify({
          mode: "single_test",
          queueId,
          sageConfigured: sage.isConfigured,
          configurationStatus: sage.configurationStatus,
          claimed: 1,
          outcome,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    // --- end single-record test mode ------------------------------------

    const batchSize = Math.min(body.batchSize ?? DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE);

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
      processed: outcomes.filter((o) => o.outcome === "processed").length,
      failed: outcomes.filter((o) => o.outcome === "validation_failed").length,
      skippedDisabled: outcomes.filter((o) => o.outcome === "skipped_disabled").length,
    };
    console.log("internal-sage-processor: run complete.", JSON.stringify(summary));

    return new Response(JSON.stringify({ ...summary, outcomes }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }),
);
