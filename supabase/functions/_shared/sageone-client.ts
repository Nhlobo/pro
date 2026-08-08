// SageOne (Sage Business Cloud Accounting) client abstraction.
//
// STATUS: STUBBED / DISABLED. No real HTTP calls are implemented.
//
// The official South African Sage Business Cloud Accounting API contract
// (base URL, OAuth flow, request/response schemas, customer/invoice field
// names) has NOT been confirmed against authoritative Sage documentation.
// Until it is, every operation on this client throws
// `SageIntegrationDisabledError` before any network code runs — it is
// structurally impossible for a caller to trigger a real external request
// through this module in its current state.
//
// When the real API is confirmed, only this file should need a second
// implementation (e.g. a `LiveSageOneClient` class satisfying the same
// `SageOneClient` interface) — callers (the processor) never change.

/** Categories a SageOne operation failure can fall into. Mirrors the
 * ErrorCode taxonomy in `_shared/errors.ts` so the processor can reuse
 * the same classification/handling logic across every external call. */
export type SageErrorCategory =
  | "CONFIGURATION_ERROR" // integration not configured/enabled
  | "VALIDATION_ERROR" // invoice/customer data insufficient for Sage
  | "AUTHENTICATION_ERROR" // Sage auth/token failure
  | "RATE_LIMITED" // Sage rate limit hit — retryable
  | "TRANSIENT_UPSTREAM_ERROR" // network/timeout/5xx — retryable
  | "PERMANENT_UPSTREAM_ERROR" // Sage rejected the request — not retryable
  | "DUPLICATE_INVOICE"; // Sage already has this invoice — treat as success

export class SageOperationError extends Error {
  category: SageErrorCategory;
  /** True if a later retry of the same operation is expected to help. */
  retryable: boolean;

  constructor(category: SageErrorCategory, message: string, retryable: boolean) {
    super(message);
    this.name = "SageOperationError";
    this.category = category;
    this.retryable = retryable;
  }
}

/** Thrown by every client method while the integration is disabled/stubbed. */
export class SageIntegrationDisabledError extends SageOperationError {
  constructor(reason: string) {
    super("CONFIGURATION_ERROR", `SageOne integration is disabled: ${reason}`, false);
    this.name = "SageIntegrationDisabledError";
  }
}

export interface SageCustomerInput {
  /** Our internal referring attorney id — used for lookup/idempotency once
   * a real customer-mapping mechanism is confirmed. Never sent to Sage
   * as-is until that mapping is defined. */
  referringAttorneyId: string;
  name: string;
  email?: string | null;
}

export interface SageCustomerResult {
  sageCustomerId: string;
}

export interface SageInvoiceLineInput {
  description: string;
  /** Excl. VAT, matching internal_invoices.amount */
  amountExclVat: number;
}

export interface SageInvoiceInput {
  /** Our internal_invoices.id — the idempotency anchor for this call. */
  internalInvoiceId: string;
  invoiceNumber: string;
  invoiceDate: string; // ISO date
  dueDate: string | null; // ISO date, nullable (agreement-governed cases)
  customer: SageCustomerResult;
  lines: SageInvoiceLineInput[];
  vatAmount: number;
  totalAmount: number;
}

export interface SageInvoiceResult {
  sageInvoiceId: string;
  /** Stored verbatim into internal_sage_queue.sage_reference */
  sageReference: string;
}

/** The stable interface the processor depends on. A future real
 * implementation (LiveSageOneClient) satisfies this same shape. */
export interface SageOneClient {
  readonly isConfigured: boolean;
  /** Human-readable reason the client is/is not configured — always
   * populated, never contains secret values. */
  readonly configurationStatus: string;

  authenticate(): Promise<void>;
  findOrCreateCustomer(input: SageCustomerInput): Promise<SageCustomerResult>;
  createInvoice(input: SageInvoiceInput): Promise<SageInvoiceResult>;
  getInvoice(sageInvoiceId: string): Promise<SageInvoiceResult | null>;
}

/** Reads config presence only — never logs or returns actual secret
 * values. Naming follows the existing precedent in
 * supabase/functions/sageone-processor/.env.example; FINAL names are
 * still pending confirmation against the real Sage API contract (see
 * .env.example in this function's directory). */
function readSageConfig() {
  const enabled = (Deno.env.get("SAGEONE_ENABLED") ?? "").toLowerCase() === "true";
  const apiUrl = Deno.env.get("SAGEONE_API_URL");
  const apiKey = Deno.env.get("SAGEONE_API_KEY");
  return { enabled, hasApiUrl: !!apiUrl, hasApiKey: !!apiKey };
}

/** Always-disabled implementation. Every method throws immediately,
 * before any fetch/network code would run. This is the ONLY
 * implementation that exists right now. */
class DisabledSageOneClient implements SageOneClient {
  readonly isConfigured = false;
  readonly configurationStatus: string;

  constructor(reason: string) {
    this.configurationStatus = reason;
  }

  private refuse(): never {
    throw new SageIntegrationDisabledError(this.configurationStatus);
  }

  authenticate(): Promise<void> {
    this.refuse();
  }
  findOrCreateCustomer(_input: SageCustomerInput): Promise<SageCustomerResult> {
    this.refuse();
  }
  createInvoice(_input: SageInvoiceInput): Promise<SageInvoiceResult> {
    this.refuse();
  }
  getInvoice(_sageInvoiceId: string): Promise<SageInvoiceResult | null> {
    this.refuse();
  }
}

/**
 * Factory used by the processor. Currently always returns a
 * DisabledSageOneClient — there is no code path in this file capable of
 * making a real HTTP request to Sage yet. Swapping in a live
 * implementation later is a change to this one function only.
 */
export function getSageOneClient(): SageOneClient {
  const config = readSageConfig();

  if (!config.enabled) {
    return new DisabledSageOneClient(
      "SAGEONE_ENABLED is not set to 'true'.",
    );
  }
  if (!config.hasApiUrl || !config.hasApiKey) {
    return new DisabledSageOneClient(
      "SageOne credentials are not fully configured (missing SAGEONE_API_URL and/or SAGEONE_API_KEY).",
    );
  }

  // Even with config present, the real HTTP implementation does not exist
  // yet — the official Sage ZA API contract has not been confirmed. This
  // is intentional: presence of env vars alone must never be enough to
  // enable real external calls.
  return new DisabledSageOneClient(
    "SageOne API contract not yet confirmed — live client not implemented.",
  );
}
