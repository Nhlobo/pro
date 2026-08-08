// SageOne (Sage Business Cloud Accounting South Africa) client.
//
// STATUS: real HTTP request mechanism implemented, but it is only ever
// reachable when SAGEONE_ENABLED=true AND every required piece of
// configuration is present (see readSageConfig/describeMissingConfig
// below). In every other case getSageOneClient() returns
// DisabledSageOneClient, whose methods throw
// SageIntegrationDisabledError before any fetch() call is made. As of
// this change no real Sage company has been tested against — do not
// flip SAGEONE_ENABLED=true outside a controlled sandbox test.
//
// Contract verified against Sage's own hosted documentation
// (accounting.sageone.co.za/api/2.0.0/Help, sage.com/en-za developer
// page) on 2026-08-08 — see
// supabase/functions/internal-sage-processor/SAGE_API_RESEARCH.md for
// the full research writeup and the list of things that are NOT yet
// confirmed (idempotency, DocumentNumber behavior, exact 400 body
// shape). Fields below only include what was actually confirmed in
// that research; nothing here is guessed.

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

/** Thrown by every client method while the integration is disabled/unconfigured. */
export class SageIntegrationDisabledError extends SageOperationError {
  constructor(reason: string) {
    super("CONFIGURATION_ERROR", `SageOne integration is disabled: ${reason}`, false);
    this.name = "SageIntegrationDisabledError";
  }
}

// ---------------------------------------------------------------------
// Domain-level types used by the processor (unchanged shape where
// possible; extended only where the verified Sage schema requires more
// than the old scaffold assumed).
// ---------------------------------------------------------------------

export interface SageCustomerInput {
  /** Our internal referring attorney id. Kept for traceability/logging
   * only — the Sage API's Get methods do not support filtering by
   * string fields (confirmed in SAGE_API_RESEARCH.md), so this value
   * CANNOT be used to look up an existing Sage customer. See
   * `findOrCreateCustomer` below for the resulting limitation. */
  referringAttorneyId: string;
  /** Maps to referring_attorneys.name. Required by Sage's Customer.Name field. */
  name: string;
  /** Maps to referring_attorneys.contact_person. */
  contactName?: string | null;
  /** Maps to referring_attorneys.email. */
  email?: string | null;
  /** Maps to referring_attorneys.phone. */
  telephone?: string | null;
  /** Maps to referring_attorneys.address (single free-text field in our
   * schema; Sage models 5 separate postal address lines — see
   * SAGE_API_RESEARCH.md, we only populate PostalAddress01 with it). */
  addressLine1?: string | null;
  /** VAT / tax registration number. There is no corresponding column on
   * referring_attorneys today, so this is always undefined in practice
   * — deliberately NOT invented. Sage's Customer.TaxReference is simply
   * left unset when this is absent. */
  taxReference?: string | null;
}

export interface SageCustomerResult {
  sageCustomerId: string;
}

export interface SageInvoiceLineInput {
  description: string;
  /** Excl. VAT, matching internal_invoices.amount */
  amountExclVat: number;
  quantity?: number;
}

export interface SageInvoiceInput {
  /** Our internal_invoices.id — the idempotency anchor for this call. */
  internalInvoiceId: string;
  invoiceNumber: string;
  invoiceDate: string; // ISO date
  dueDate: string | null; // ISO date. Sage's TaxInvoice.DueDate is
  // REQUIRED (confirmed) even though our internal_invoices.due_date is
  // nullable for agreement-governed cases. createInvoice() below
  // refuses (VALIDATION_ERROR) rather than inventing a fallback date —
  // see SAGE_API_RESEARCH.md item 7 / this file's SAGE_API_RESEARCH note.
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

export interface SageTaxType {
  id: number;
  name: string;
  percentage: number;
  isDefault: boolean;
  active: boolean;
}

/** The stable interface the processor depends on. */
export interface SageOneClient {
  readonly isConfigured: boolean;
  /** Human-readable reason the client is/is not configured — always
   * populated, never contains secret values. */
  readonly configurationStatus: string;

  authenticate(): Promise<void>;
  findOrCreateCustomer(input: SageCustomerInput): Promise<SageCustomerResult>;
  createInvoice(input: SageInvoiceInput): Promise<SageInvoiceResult>;
  getInvoice(sageInvoiceId: string): Promise<SageInvoiceResult | null>;
  /** Read-only diagnostic method for the sandbox test: lists this
   * company's real Tax Type records so a human can identify which ID
   * represents standard 15% VAT and put it in SAGEONE_TAX_TYPE_ID. Not
   * called anywhere in the automated processor flow. */
  getTaxTypes(): Promise<SageTaxType[]>;
}

// ---------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------

interface SageConfig {
  enabled: boolean;
  apiUrl: string | null;
  apiKey: string | null;
  username: string | null;
  password: string | null;
  companyId: string | null;
  /** Positive integer FK into this Sage company's own TaxType records.
   * Company-specific — never hardcoded (see SAGE_API_RESEARCH.md). */
  taxTypeId: number | null;
}

/** Reads config presence/values only — never logs secret values. */
function readSageConfig(): SageConfig {
  const enabled = (Deno.env.get("SAGEONE_ENABLED") ?? "").toLowerCase() === "true";
  const apiUrl = Deno.env.get("SAGEONE_API_URL") || null;
  const apiKey = Deno.env.get("SAGEONE_API_KEY") || null;
  const username = Deno.env.get("SAGEONE_USERNAME") || null;
  const password = Deno.env.get("SAGEONE_PASSWORD") || null;
  const companyId = Deno.env.get("SAGEONE_COMPANY_ID") || null;

  const rawTaxTypeId = Deno.env.get("SAGEONE_TAX_TYPE_ID");
  let taxTypeId: number | null = null;
  if (rawTaxTypeId) {
    const parsed = Number(rawTaxTypeId);
    if (Number.isInteger(parsed) && parsed > 0) {
      taxTypeId = parsed;
    }
  }

  return { enabled, apiUrl, apiKey, username, password, companyId, taxTypeId };
}

/** Lists exactly which required config values are missing/invalid.
 * Never includes secret values, only variable names. */
function describeMissingConfig(config: SageConfig): string[] {
  const missing: string[] = [];
  if (!config.apiUrl) missing.push("SAGEONE_API_URL");
  if (!config.apiKey) missing.push("SAGEONE_API_KEY");
  if (!config.username) missing.push("SAGEONE_USERNAME");
  if (!config.password) missing.push("SAGEONE_PASSWORD");
  if (!config.companyId) missing.push("SAGEONE_COMPANY_ID");
  if (!config.taxTypeId) missing.push("SAGEONE_TAX_TYPE_ID (must be a positive integer)");
  return missing;
}

function isFullyConfigured(config: SageConfig): boolean {
  return describeMissingConfig(config).length === 0;
}

// ---------------------------------------------------------------------
// Low-level HTTP mechanics — verified request shape.
// Exported individually so tests can exercise them without going
// through a full client instance or a live network call.
// ---------------------------------------------------------------------

/** `Authorization: Basic base64(username:password)` — confirmed auth
 * mechanism for this API (HTTP Basic auth using a real Sage user's
 * email + password; NOT a bearer token). */
export function buildBasicAuthHeader(username: string, password: string): string {
  const encoded = btoa(`${username}:${password}`);
  return `Basic ${encoded}`;
}

/** Builds `[apiUrl]/api/2.0.0/[service]/[method]/[id?]?apikey=...&companyid=...`
 * — confirmed URL structure. `extraQuery` is for method-specific
 * parameters (e.g. OData `$top`/`$skip`), none of which are used yet. */
export function buildSageUrl(
  config: Pick<SageConfig, "apiUrl" | "apiKey" | "companyId">,
  service: string,
  method: string,
  id?: string | number,
  extraQuery?: Record<string, string>,
): string {
  const base = (config.apiUrl ?? "").replace(/\/+$/, "");
  const idSegment = id !== undefined && id !== null ? `/${id}` : "";
  const url = new URL(`${base}/api/2.0.0/${service}/${method}${idSegment}`);
  url.searchParams.set("apikey", config.apiKey ?? "");
  url.searchParams.set("companyid", config.companyId ?? "");
  for (const [key, value] of Object.entries(extraQuery ?? {})) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

/** Classifies a Sage HTTP response status into our error taxonomy.
 * Table confirmed against Sage's own documented response codes — see
 * SAGE_API_RESEARCH.md. Exported for direct unit testing. */
export function classifySageHttpStatus(
  status: number,
  bodyText: string,
): { category: SageErrorCategory; retryable: boolean; message: string } {
  if (status >= 200 && status < 300) {
    throw new Error("classifySageHttpStatus should only be called for non-2xx responses");
  }
  switch (status) {
    case 400:
      return { category: "VALIDATION_ERROR", retryable: false, message: `Sage validation error (400): ${bodyText}` };
    case 401:
      return {
        category: "AUTHENTICATION_ERROR",
        retryable: false,
        message: `Sage authentication failed (401). Check SAGEONE_USERNAME/SAGEONE_PASSWORD/SAGEONE_API_KEY.`,
      };
    case 404:
      return { category: "PERMANENT_UPSTREAM_ERROR", retryable: false, message: `Sage entity not found (404): ${bodyText}` };
    case 405:
      return { category: "PERMANENT_UPSTREAM_ERROR", retryable: false, message: `Sage method not allowed (405): ${bodyText}` };
    case 409:
      return { category: "PERMANENT_UPSTREAM_ERROR", retryable: false, message: `Sage conflict (409): ${bodyText}` };
    case 415:
      return {
        category: "PERMANENT_UPSTREAM_ERROR",
        retryable: false,
        message: `Sage rejected the request Content-Type (415) — this indicates a bug in the client, not the data: ${bodyText}`,
      };
    case 429:
      // Confirmed: Sage blocks the IP for 1 hour (or the username for 24
      // hours after repeated failed logins) if you keep hitting a 429.
      // Retryable in principle, but the caller must NOT loop/retry this
      // in-process — only a later, separately-scheduled queue run should
      // retry it. See withBoundedTransientRetry below, which deliberately
      // excludes RATE_LIMITED from its retry loop.
      return {
        category: "RATE_LIMITED",
        retryable: true,
        message: `Sage rate limit hit (429): ${bodyText}`,
      };
    case 500:
      return { category: "TRANSIENT_UPSTREAM_ERROR", retryable: true, message: `Sage server error (500): ${bodyText}` };
    case 503:
      return { category: "TRANSIENT_UPSTREAM_ERROR", retryable: true, message: `Sage unavailable (503): ${bodyText}` };
    default:
      return {
        category: "PERMANENT_UPSTREAM_ERROR",
        retryable: false,
        message: `Unexpected Sage HTTP status ${status}: ${bodyText}`,
      };
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Retries ONLY genuinely transient failures (5xx, network errors) with
 * a short bounded backoff. Deliberately does NOT retry 429 (rate limit
 * — Sage explicitly documents that continuing to call during a block
 * extends it) or 401/400/404/405/409/415 (retrying an identical request
 * cannot fix any of those). */
async function withBoundedTransientRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number,
  baseDelayMs: number,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isTransient = err instanceof SageOperationError && err.category === "TRANSIENT_UPSTREAM_ERROR";
      const isNetworkError = !(err instanceof SageOperationError);
      if ((isTransient || isNetworkError) && attempt < maxAttempts) {
        await sleep(baseDelayMs * attempt);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

// ---------------------------------------------------------------------
// Raw Sage payload shapes — field names/types copied verbatim from the
// verified TaxInvoice/Customer/TaxType schemas. Only fields we actually
// populate or read are listed; Sage's real models have many more
// read-only/system fields we never touch.
// ---------------------------------------------------------------------

interface SageCustomerPayload {
  ID?: number;
  Name: string;
  ContactName?: string;
  Email?: string;
  Telephone?: string;
  TaxReference?: string;
  PostalAddress01?: string;
  Active?: boolean;
}

interface SageCommercialDocumentLinePayload {
  SelectionId?: number;
  LineType: number; // 0 = Item, 1 = Account
  TaxTypeId: number;
  Description: string;
  Quantity: number;
  UnitPriceExclusive: number;
}

interface SageTaxInvoicePayload {
  ID?: number;
  Date: string;
  DueDate: string;
  CustomerId: number;
  Reference?: string;
  ExternalReference?: string;
  DocumentNumber?: string;
  Inclusive: boolean;
  Lines: SageCommercialDocumentLinePayload[];
}

interface SageTaxTypeRecord {
  ID: number;
  Name: string;
  Percentage: number;
  IsDefault: boolean;
  Active: boolean;
}

interface SageGetListResponse<T> {
  TotalResults: number;
  ReturnedResults: number;
  Results: T[];
}

// ---------------------------------------------------------------------
// Live client
// ---------------------------------------------------------------------

export interface LiveSageOneClientOptions {
  /** Injectable for tests — defaults to globalThis.fetch. */
  fetchImpl?: typeof fetch;
  /** Minimum spacing between outgoing requests, to stay well under
   * Sage's documented 100 requests/minute limit. Default ~700ms
   * (under 100/min with margin). Tests set this to 0. */
  minRequestIntervalMs?: number;
  /** Max attempts for the bounded transient-error retry. Default 3. */
  maxTransientRetries?: number;
  /** Base backoff delay for transient retries. Default 300ms. */
  transientRetryBaseDelayMs?: number;
}

export class LiveSageOneClient implements SageOneClient {
  readonly isConfigured = true;
  readonly configurationStatus = "SageOne is fully configured and enabled.";

  private readonly config: SageConfig;
  private readonly fetchImpl: typeof fetch;
  private readonly minRequestIntervalMs: number;
  private readonly maxTransientRetries: number;
  private readonly transientRetryBaseDelayMs: number;
  private lastRequestAt = 0;

  constructor(config: SageConfig, options: LiveSageOneClientOptions = {}) {
    this.config = config;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.minRequestIntervalMs = options.minRequestIntervalMs ?? 700;
    this.maxTransientRetries = options.maxTransientRetries ?? 3;
    this.transientRetryBaseDelayMs = options.transientRetryBaseDelayMs ?? 300;
  }

  private async throttle(): Promise<void> {
    if (this.minRequestIntervalMs <= 0) return;
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < this.minRequestIntervalMs) {
      await sleep(this.minRequestIntervalMs - elapsed);
    }
    this.lastRequestAt = Date.now();
  }

  /** Performs one raw HTTP call against Sage, with auth headers, JSON
   * parsing, and status classification. Does NOT retry — callers wrap
   * with withBoundedTransientRetry where retrying is appropriate. */
  private async rawRequest<T>(
    method: "GET" | "POST",
    service: string,
    sageMethod: string,
    opts: { id?: string | number; body?: unknown } = {},
  ): Promise<T> {
    await this.throttle();
    const url = buildSageUrl(this.config, service, sageMethod, opts.id);
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method,
        headers: {
          Authorization: buildBasicAuthHeader(this.config.username!, this.config.password!),
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      });
    } catch (networkErr) {
      throw new SageOperationError(
        "TRANSIENT_UPSTREAM_ERROR",
        `Network error calling Sage ${service}/${sageMethod}: ${
          networkErr instanceof Error ? networkErr.message : String(networkErr)
        }`,
        true,
      );
    }

    const bodyText = await response.text();
    if (!response.ok) {
      const { category, retryable, message } = classifySageHttpStatus(response.status, bodyText);
      throw new SageOperationError(category, message, retryable);
    }
    if (!bodyText) {
      return undefined as unknown as T;
    }
    try {
      return JSON.parse(bodyText) as T;
    } catch {
      throw new SageOperationError(
        "PERMANENT_UPSTREAM_ERROR",
        `Sage ${service}/${sageMethod} returned non-JSON response: ${bodyText.slice(0, 500)}`,
        false,
      );
    }
  }

  private requestWithRetry<T>(
    method: "GET" | "POST",
    service: string,
    sageMethod: string,
    opts: { id?: string | number; body?: unknown } = {},
  ): Promise<T> {
    return withBoundedTransientRetry(
      () => this.rawRequest<T>(method, service, sageMethod, opts),
      this.maxTransientRetries,
      this.transientRetryBaseDelayMs,
    );
  }

  // -- Typed low-level Sage methods -------------------------------------

  async saveCustomer(payload: SageCustomerPayload): Promise<SageCustomerPayload> {
    return this.requestWithRetry<SageCustomerPayload>("POST", "Customer", "Save", { body: payload });
  }

  async saveTaxInvoice(payload: SageTaxInvoicePayload): Promise<SageTaxInvoicePayload & { ID: number }> {
    return this.requestWithRetry<SageTaxInvoicePayload & { ID: number }>("POST", "TaxInvoice", "Save", {
      body: payload,
    });
  }

  async getTaxTypesRaw(): Promise<SageGetListResponse<SageTaxTypeRecord>> {
    return this.requestWithRetry<SageGetListResponse<SageTaxTypeRecord>>("GET", "TaxType", "Get");
  }

  async getTaxInvoiceRaw(id: number): Promise<SageTaxInvoicePayload & { ID: number }> {
    return this.requestWithRetry<SageTaxInvoicePayload & { ID: number }>("GET", "TaxInvoice", "Get", { id });
  }

  // -- SageOneClient interface -------------------------------------------

  /** There is no separate "login" call in this Basic-auth API. As the
   * closest available check, this performs one lightweight, read-only,
   * company-scoped call (TaxType/Get) so a 401 (bad username/password
   * or apikey) or a companyid mismatch surfaces immediately rather than
   * on the first real invoice submission. */
  async authenticate(): Promise<void> {
    await this.getTaxTypesRaw();
  }

  async getTaxTypes(): Promise<SageTaxType[]> {
    const raw = await this.getTaxTypesRaw();
    return raw.Results.map((t) => ({
      id: t.ID,
      name: t.Name,
      percentage: t.Percentage,
      isDefault: t.IsDefault,
      active: t.Active,
    }));
  }

  /**
   * KNOWN LIMITATION (documented, not silently papered over): Sage's
   * Get methods do not support filtering by string fields (confirmed —
   * see SAGE_API_RESEARCH.md), so there is no reliable way to ask Sage
   * "does a customer for this referring attorney already exist?". This
   * method therefore ALWAYS creates a new Sage customer. Without a
   * local table mapping referring_attorney_id -> sageCustomerId (which
   * does not exist in this schema and was not added here, per the
   * instruction not to invent solutions), calling this once per invoice
   * run WILL create duplicate Sage customers for the same attorney.
   * This must be resolved (either by adding a mapping table, or by a
   * confirmed Sage-side lookup mechanism) before this is used against a
   * real company beyond a single controlled sandbox test.
   */
  async findOrCreateCustomer(input: SageCustomerInput): Promise<SageCustomerResult> {
    if (!input.name || !input.name.trim()) {
      throw new SageOperationError(
        "VALIDATION_ERROR",
        `Cannot create a Sage customer for referring attorney ${input.referringAttorneyId}: no name available.`,
        false,
      );
    }
    const payload: SageCustomerPayload = {
      Name: input.name,
      Active: true,
      ...(input.contactName ? { ContactName: input.contactName } : {}),
      ...(input.email ? { Email: input.email } : {}),
      ...(input.telephone ? { Telephone: input.telephone } : {}),
      ...(input.addressLine1 ? { PostalAddress01: input.addressLine1 } : {}),
      ...(input.taxReference ? { TaxReference: input.taxReference } : {}),
    };
    const result = await this.saveCustomer(payload);
    if (result.ID === undefined) {
      throw new SageOperationError(
        "PERMANENT_UPSTREAM_ERROR",
        `Sage Customer/Save did not return an ID for referring attorney ${input.referringAttorneyId}.`,
        false,
      );
    }
    return { sageCustomerId: String(result.ID) };
  }

  async createInvoice(input: SageInvoiceInput): Promise<SageInvoiceResult> {
    // Sage's TaxInvoice.DueDate is REQUIRED (confirmed). Our internal
    // due_date can be null. Rather than inventing a fallback (e.g.
    // defaulting to invoiceDate), this refuses — the fallback behavior
    // is a business decision for the controlled sandbox test, not
    // something to guess here.
    if (!input.dueDate) {
      throw new SageOperationError(
        "VALIDATION_ERROR",
        `Cannot submit invoice ${input.invoiceNumber} to Sage: due_date is null and Sage's TaxInvoice.DueDate is required. ` +
          `No fallback has been decided (see SAGE_API_RESEARCH.md) — resolve this as part of the controlled sandbox test.`,
        false,
      );
    }
    const customerId = Number(input.customer.sageCustomerId);
    if (!Number.isInteger(customerId) || customerId <= 0) {
      throw new SageOperationError(
        "VALIDATION_ERROR",
        `Invalid Sage customer id "${input.customer.sageCustomerId}" for invoice ${input.invoiceNumber}.`,
        false,
      );
    }
    if (input.lines.length === 0) {
      throw new SageOperationError(
        "VALIDATION_ERROR",
        `Invoice ${input.invoiceNumber} has no line items.`,
        false,
      );
    }

    const payload: SageTaxInvoicePayload = {
      Date: input.invoiceDate,
      DueDate: input.dueDate,
      CustomerId: customerId,
      Reference: input.invoiceNumber,
      // Free-text field, not a confirmed dedupe key (see
      // SAGE_API_RESEARCH.md) — used only so a human can trace a Sage
      // invoice back to our internal_invoices row.
      ExternalReference: input.internalInvoiceId,
      // DocumentNumber deliberately left unset — whether Sage honours a
      // caller-supplied value here is unconfirmed. See
      // SAGE_API_RESEARCH.md item 7 / controlled-test items.
      Inclusive: false, // our amounts are excl. VAT (internal_invoices.amount)
      Lines: input.lines.map((line) => ({
        LineType: 1, // 1 = Account — we invoice against an account, not a stock Item
        TaxTypeId: this.config.taxTypeId!,
        Description: line.description,
        Quantity: line.quantity ?? 1,
        UnitPriceExclusive: line.amountExclVat,
      })),
    };

    const result = await this.saveTaxInvoice(payload);
    return {
      sageInvoiceId: String(result.ID),
      // No confirmed unique reference field beyond the numeric ID (UID
      // was seen in the model but not confirmed as returned by Save
      // specifically) — using ID, which IS confirmed to be assigned on
      // create.
      sageReference: String(result.ID),
    };
  }

  async getInvoice(sageInvoiceId: string): Promise<SageInvoiceResult | null> {
    const id = Number(sageInvoiceId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new SageOperationError("VALIDATION_ERROR", `Invalid Sage invoice id "${sageInvoiceId}".`, false);
    }
    try {
      const result = await this.getTaxInvoiceRaw(id);
      return { sageInvoiceId: String(result.ID), sageReference: String(result.ID) };
    } catch (err) {
      if (err instanceof SageOperationError && err.category === "PERMANENT_UPSTREAM_ERROR" && /404/.test(err.message)) {
        return null;
      }
      throw err;
    }
  }
}

// ---------------------------------------------------------------------
// Disabled client (unchanged behavior)
// ---------------------------------------------------------------------

/** Refuses every operation immediately, before any fetch/network code
 * would run. Returned whenever SAGEONE_ENABLED is not 'true' or any
 * required config value is missing/invalid. */
class DisabledSageOneClient implements SageOneClient {
  readonly isConfigured = false;
  readonly configurationStatus: string;

  constructor(reason: string) {
    this.configurationStatus = reason;
  }

  private refuse(): never {
    throw new SageIntegrationDisabledError(this.configurationStatus);
  }

  async authenticate(): Promise<void> {
    this.refuse();
  }
  async findOrCreateCustomer(_input: SageCustomerInput): Promise<SageCustomerResult> {
    this.refuse();
  }
  async createInvoice(_input: SageInvoiceInput): Promise<SageInvoiceResult> {
    this.refuse();
  }
  async getInvoice(_sageInvoiceId: string): Promise<SageInvoiceResult | null> {
    this.refuse();
  }
  async getTaxTypes(): Promise<SageTaxType[]> {
    this.refuse();
  }
}

/**
 * Factory used by the processor. Returns a LiveSageOneClient only when
 * SAGEONE_ENABLED=true AND every required config value
 * (SAGEONE_API_URL, SAGEONE_API_KEY, SAGEONE_USERNAME, SAGEONE_PASSWORD,
 * SAGEONE_COMPANY_ID, SAGEONE_TAX_TYPE_ID) is present and valid.
 * Otherwise returns DisabledSageOneClient. Default deployment has
 * SAGEONE_ENABLED unset/false, so this returns DisabledSageOneClient by
 * default with no code changes required anywhere else.
 */
export function getSageOneClient(options?: LiveSageOneClientOptions): SageOneClient {
  const config = readSageConfig();

  if (!config.enabled) {
    return new DisabledSageOneClient("SAGEONE_ENABLED is not set to 'true'.");
  }

  const missing = describeMissingConfig(config);
  if (missing.length > 0) {
    return new DisabledSageOneClient(
      `SageOne is enabled but missing required configuration: ${missing.join(", ")}.`,
    );
  }

  return new LiveSageOneClient(config, options);
}
