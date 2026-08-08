// Run with: deno test --allow-env supabase/functions/_shared/sageone-client.test.ts
//
// Note: this repo has no existing edge-function test convention (no
// prior *.test.ts under supabase/functions/, and vitest is scoped to
// src/** only). These use Deno's built-in test runner, the standard
// choice for Deno-based Supabase Edge Functions.
//
// EVERY test in this file uses a mocked fetch (fetchImpl injection) or
// no fetch at all. No test in this file makes a real network call to
// Sage or anywhere else.

import { assert, assertEquals, assertRejects } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  buildBasicAuthHeader,
  buildSageUrl,
  classifySageHttpStatus,
  getSageOneClient,
  LiveSageOneClient,
  SageIntegrationDisabledError,
  SageOperationError,
} from "./sageone-client.ts";

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const previous: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    previous[k] = Deno.env.get(k);
    if (v === undefined) Deno.env.delete(k);
    else Deno.env.set(k, v);
  }
  try {
    fn();
  } finally {
    for (const [k, v] of Object.entries(previous)) {
      if (v === undefined) Deno.env.delete(k);
      else Deno.env.set(k, v);
    }
  }
}

async function withEnvAsync(vars: Record<string, string | undefined>, fn: () => Promise<void>) {
  const previous: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    previous[k] = Deno.env.get(k);
    if (v === undefined) Deno.env.delete(k);
    else Deno.env.set(k, v);
  }
  try {
    await fn();
  } finally {
    for (const [k, v] of Object.entries(previous)) {
      if (v === undefined) Deno.env.delete(k);
      else Deno.env.set(k, v);
    }
  }
}

const FULL_VALID_ENV = {
  SAGEONE_ENABLED: "true",
  SAGEONE_API_URL: "https://accounting.sageone.co.za",
  SAGEONE_API_KEY: "test-api-key",
  SAGEONE_USERNAME: "api-user@example.co.za",
  SAGEONE_PASSWORD: "test-password",
  SAGEONE_COMPANY_ID: "12345",
  SAGEONE_TAX_TYPE_ID: "7",
};

/** Records every call made to it and returns queued responses in order. */
function mockFetch(responses: Array<{ status: number; body?: string } | (() => never)>) {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  let i = 0;
  const impl = ((input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    const next = responses[Math.min(i, responses.length - 1)];
    i++;
    if (typeof next === "function") {
      return next();
    }
    return Promise.resolve(new Response(next.body ?? "", { status: next.status }));
  }) as typeof fetch;
  return { impl, calls };
}

// ---------------------------------------------------------------------
// Disabled-state / configuration tests
// ---------------------------------------------------------------------

Deno.test("client is disabled when SAGEONE_ENABLED is unset", () => {
  withEnv(
    {
      SAGEONE_ENABLED: undefined,
      SAGEONE_API_URL: undefined,
      SAGEONE_API_KEY: undefined,
      SAGEONE_USERNAME: undefined,
      SAGEONE_PASSWORD: undefined,
      SAGEONE_COMPANY_ID: undefined,
      SAGEONE_TAX_TYPE_ID: undefined,
    },
    () => {
      const client = getSageOneClient();
      assertEquals(client.isConfigured, false);
      assert(client.configurationStatus.includes("SAGEONE_ENABLED"));
    },
  );
});

Deno.test("client is disabled and lists every missing var when enabled=true but nothing else is set", () => {
  withEnv(
    {
      SAGEONE_ENABLED: "true",
      SAGEONE_API_URL: undefined,
      SAGEONE_API_KEY: undefined,
      SAGEONE_USERNAME: undefined,
      SAGEONE_PASSWORD: undefined,
      SAGEONE_COMPANY_ID: undefined,
      SAGEONE_TAX_TYPE_ID: undefined,
    },
    () => {
      const client = getSageOneClient();
      assertEquals(client.isConfigured, false);
      for (const name of [
        "SAGEONE_API_URL",
        "SAGEONE_API_KEY",
        "SAGEONE_USERNAME",
        "SAGEONE_PASSWORD",
        "SAGEONE_COMPANY_ID",
        "SAGEONE_TAX_TYPE_ID",
      ]) {
        assert(client.configurationStatus.includes(name), `expected missing-config message to mention ${name}`);
      }
    },
  );
});

Deno.test("client is disabled when only some required config is present", () => {
  withEnv(
    {
      SAGEONE_ENABLED: "true",
      SAGEONE_API_URL: "https://accounting.sageone.co.za",
      SAGEONE_API_KEY: "test-key",
      SAGEONE_USERNAME: undefined,
      SAGEONE_PASSWORD: undefined,
      SAGEONE_COMPANY_ID: undefined,
      SAGEONE_TAX_TYPE_ID: undefined,
    },
    () => {
      const client = getSageOneClient();
      assertEquals(client.isConfigured, false);
      assert(client.configurationStatus.includes("SAGEONE_USERNAME"));
      assert(client.configurationStatus.includes("SAGEONE_COMPANY_ID"));
    },
  );
});

Deno.test("client is disabled when SAGEONE_TAX_TYPE_ID is present but not a positive integer", () => {
  withEnv({ ...FULL_VALID_ENV, SAGEONE_TAX_TYPE_ID: "not-a-number" }, () => {
    const client = getSageOneClient();
    assertEquals(client.isConfigured, false);
    assert(client.configurationStatus.includes("SAGEONE_TAX_TYPE_ID"));
  });

  withEnv({ ...FULL_VALID_ENV, SAGEONE_TAX_TYPE_ID: "0" }, () => {
    const client = getSageOneClient();
    assertEquals(client.isConfigured, false);
  });

  withEnv({ ...FULL_VALID_ENV, SAGEONE_TAX_TYPE_ID: "-3" }, () => {
    const client = getSageOneClient();
    assertEquals(client.isConfigured, false);
  });
});

Deno.test("client IS configured (live) when SAGEONE_ENABLED=true and every required value is present", () => {
  withEnv(FULL_VALID_ENV, () => {
    const client = getSageOneClient();
    assertEquals(client.isConfigured, true);
    assert(client instanceof LiveSageOneClient);
  });
});

Deno.test("disabled client: every operation throws SageIntegrationDisabledError before any network call", async () => {
  await withEnvAsync({ SAGEONE_ENABLED: undefined }, async () => {
    const client = getSageOneClient();
    assertEquals(client.isConfigured, false);

    await assertRejects(() => client.authenticate(), SageIntegrationDisabledError);
    await assertRejects(
      () => client.findOrCreateCustomer({ referringAttorneyId: "x", name: "Test" }),
      SageIntegrationDisabledError,
    );
    await assertRejects(
      () =>
        client.createInvoice({
          internalInvoiceId: "x",
          invoiceNumber: "INV-2026-000001",
          invoiceDate: new Date().toISOString(),
          dueDate: null,
          customer: { sageCustomerId: "x" },
          lines: [],
          vatAmount: 0,
          totalAmount: 0,
        }),
      SageIntegrationDisabledError,
    );
    await assertRejects(() => client.getInvoice("x"), SageIntegrationDisabledError);
    await assertRejects(() => client.getTaxTypes(), SageIntegrationDisabledError);
  });
});

// ---------------------------------------------------------------------
// Low-level building blocks
// ---------------------------------------------------------------------

Deno.test("buildBasicAuthHeader base64-encodes username:password", () => {
  const header = buildBasicAuthHeader("user@example.co.za", "s3cret");
  assertEquals(header, `Basic ${btoa("user@example.co.za:s3cret")}`);
});

Deno.test("buildSageUrl includes the required apikey and companyid query params and correct path", () => {
  const url = buildSageUrl(
    { apiUrl: "https://accounting.sageone.co.za", apiKey: "abc123", companyId: "999" },
    "Customer",
    "Save",
  );
  const parsed = new URL(url);
  assertEquals(parsed.origin, "https://accounting.sageone.co.za");
  assertEquals(parsed.pathname, "/api/2.0.0/Customer/Save");
  assertEquals(parsed.searchParams.get("apikey"), "abc123");
  assertEquals(parsed.searchParams.get("companyid"), "999");
});

Deno.test("buildSageUrl appends an id segment when provided (e.g. TaxInvoice/Get/{id})", () => {
  const url = buildSageUrl(
    { apiUrl: "https://accounting.sageone.co.za", apiKey: "k", companyId: "1" },
    "TaxInvoice",
    "Get",
    42,
  );
  assertEquals(new URL(url).pathname, "/api/2.0.0/TaxInvoice/Get/42");
});

Deno.test("buildSageUrl strips a trailing slash on the configured base URL", () => {
  const url = buildSageUrl(
    { apiUrl: "https://accounting.sageone.co.za/", apiKey: "k", companyId: "1" },
    "Customer",
    "Save",
  );
  assertEquals(new URL(url).pathname, "/api/2.0.0/Customer/Save");
});

// ---------------------------------------------------------------------
// HTTP status classification
// ---------------------------------------------------------------------

Deno.test("classifySageHttpStatus maps every documented status to the right category/retryable", () => {
  const cases: Array<[number, string, boolean]> = [
    [400, "VALIDATION_ERROR", false],
    [401, "AUTHENTICATION_ERROR", false],
    [404, "PERMANENT_UPSTREAM_ERROR", false],
    [405, "PERMANENT_UPSTREAM_ERROR", false],
    [409, "PERMANENT_UPSTREAM_ERROR", false],
    [415, "PERMANENT_UPSTREAM_ERROR", false],
    [429, "RATE_LIMITED", true],
    [500, "TRANSIENT_UPSTREAM_ERROR", true],
    [503, "TRANSIENT_UPSTREAM_ERROR", true],
  ];
  for (const [status, category, retryable] of cases) {
    const result = classifySageHttpStatus(status, "body");
    assertEquals(result.category, category, `status ${status}`);
    assertEquals(result.retryable, retryable, `status ${status}`);
  }
});

Deno.test("classifySageHttpStatus falls back to non-retryable PERMANENT_UPSTREAM_ERROR for unlisted statuses", () => {
  const result = classifySageHttpStatus(418, "teapot");
  assertEquals(result.category, "PERMANENT_UPSTREAM_ERROR");
  assertEquals(result.retryable, false);
});

// ---------------------------------------------------------------------
// Live client — request construction (mocked fetch, no real network)
// ---------------------------------------------------------------------

Deno.test("Customer/Save: constructs the correct method/url/headers/body", async () => {
  await withEnvAsync(FULL_VALID_ENV, async () => {
    const { impl, calls } = mockFetch([{ status: 200, body: JSON.stringify({ ID: 501 }) }]);
    const client = getSageOneClient({ fetchImpl: impl, minRequestIntervalMs: 0 }) as LiveSageOneClient;

    const result = await client.findOrCreateCustomer({
      referringAttorneyId: "attorney-1",
      name: "Smith & Associates",
      contactName: "Jane Smith",
      email: "jane@smithlaw.example",
      telephone: "0111234567",
      addressLine1: "1 Long St, Cape Town",
    });

    assertEquals(result.sageCustomerId, "501");
    assertEquals(calls.length, 1);
    const call = calls[0];
    assertEquals(call.init?.method, "POST");
    const url = new URL(call.url);
    assertEquals(url.pathname, "/api/2.0.0/Customer/Save");
    assertEquals(url.searchParams.get("apikey"), "test-api-key");
    assertEquals(url.searchParams.get("companyid"), "12345");
    assertEquals(
      (call.init?.headers as Record<string, string>)["Authorization"],
      buildBasicAuthHeader("api-user@example.co.za", "test-password"),
    );
    assertEquals((call.init?.headers as Record<string, string>)["Content-Type"], "application/json");
    const body = JSON.parse(call.init?.body as string);
    assertEquals(body.Name, "Smith & Associates");
    assertEquals(body.ContactName, "Jane Smith");
    assertEquals(body.Email, "jane@smithlaw.example");
    assertEquals(body.Telephone, "0111234567");
    assertEquals(body.PostalAddress01, "1 Long St, Cape Town");
    // No VAT/tax reference source exists on referring_attorneys — must
    // never be invented as a request field.
    assertEquals(body.TaxReference, undefined);
  });
});

Deno.test("findOrCreateCustomer refuses (VALIDATION_ERROR) without calling fetch when name is missing", async () => {
  await withEnvAsync(FULL_VALID_ENV, async () => {
    const { impl, calls } = mockFetch([{ status: 200, body: "{}" }]);
    const client = getSageOneClient({ fetchImpl: impl, minRequestIntervalMs: 0 }) as LiveSageOneClient;

    const err = await assertRejects(
      () => client.findOrCreateCustomer({ referringAttorneyId: "attorney-1", name: "" }),
      SageOperationError,
    );
    assertEquals((err as SageOperationError).category, "VALIDATION_ERROR");
    assertEquals(calls.length, 0);
  });
});

Deno.test("TaxInvoice/Save: constructs the correct method/url/body, VAT-inclusive mapping, and tax type from config", async () => {
  await withEnvAsync(FULL_VALID_ENV, async () => {
    const { impl, calls } = mockFetch([{ status: 200, body: JSON.stringify({ ID: 9001 }) }]);
    const client = getSageOneClient({ fetchImpl: impl, minRequestIntervalMs: 0 }) as LiveSageOneClient;

    const result = await client.createInvoice({
      internalInvoiceId: "inv-uuid-1",
      invoiceNumber: "INV-2026-000123",
      invoiceDate: "2026-08-01",
      dueDate: "2026-08-31",
      customer: { sageCustomerId: "501" },
      lines: [
        { description: "Medico-legal report", amountExclVat: 15000 },
        { description: "Consultation", amountExclVat: 2500, quantity: 2 },
      ],
      vatAmount: 2625,
      totalAmount: 20125,
    });

    assertEquals(result.sageInvoiceId, "9001");
    assertEquals(result.sageReference, "9001");
    assertEquals(calls.length, 1);
    const call = calls[0];
    assertEquals(call.init?.method, "POST");
    assertEquals(new URL(call.url).pathname, "/api/2.0.0/TaxInvoice/Save");
    const body = JSON.parse(call.init?.body as string);
    assertEquals(body.Date, "2026-08-01");
    assertEquals(body.DueDate, "2026-08-31");
    assertEquals(body.CustomerId, 501);
    assertEquals(body.Reference, "INV-2026-000123");
    assertEquals(body.ExternalReference, "inv-uuid-1");
    assertEquals(body.DocumentNumber, undefined); // deliberately unset — see SAGE_API_RESEARCH.md
    assertEquals(body.Inclusive, false); // internal_invoices.amount is excl. VAT
    assertEquals(body.Lines.length, 2);
    assertEquals(body.Lines[0].TaxTypeId, 7); // from SAGEONE_TAX_TYPE_ID
    assertEquals(body.Lines[0].UnitPriceExclusive, 15000);
    assertEquals(body.Lines[0].Quantity, 1); // default when not specified
    assertEquals(body.Lines[1].TaxTypeId, 7);
    assertEquals(body.Lines[1].Quantity, 2);
  });
});

Deno.test("createInvoice refuses (VALIDATION_ERROR) without calling fetch when dueDate is null", async () => {
  await withEnvAsync(FULL_VALID_ENV, async () => {
    const { impl, calls } = mockFetch([{ status: 200, body: "{}" }]);
    const client = getSageOneClient({ fetchImpl: impl, minRequestIntervalMs: 0 }) as LiveSageOneClient;

    const err = await assertRejects(
      () =>
        client.createInvoice({
          internalInvoiceId: "inv-uuid-2",
          invoiceNumber: "INV-2026-000124",
          invoiceDate: "2026-08-01",
          dueDate: null,
          customer: { sageCustomerId: "501" },
          lines: [{ description: "x", amountExclVat: 100 }],
          vatAmount: 15,
          totalAmount: 115,
        }),
      SageOperationError,
    );
    assertEquals((err as SageOperationError).category, "VALIDATION_ERROR");
    assertEquals(calls.length, 0, "Sage must never be called for a request we already know is invalid");
  });
});

Deno.test("createInvoice refuses without calling fetch when there are no line items", async () => {
  await withEnvAsync(FULL_VALID_ENV, async () => {
    const { impl, calls } = mockFetch([{ status: 200, body: "{}" }]);
    const client = getSageOneClient({ fetchImpl: impl, minRequestIntervalMs: 0 }) as LiveSageOneClient;

    await assertRejects(
      () =>
        client.createInvoice({
          internalInvoiceId: "inv-uuid-3",
          invoiceNumber: "INV-2026-000125",
          invoiceDate: "2026-08-01",
          dueDate: "2026-08-31",
          customer: { sageCustomerId: "501" },
          lines: [],
          vatAmount: 0,
          totalAmount: 0,
        }),
      SageOperationError,
    );
    assertEquals(calls.length, 0);
  });
});

Deno.test("TaxType/Get: constructs a GET request with no body and maps the response", async () => {
  await withEnvAsync(FULL_VALID_ENV, async () => {
    const { impl, calls } = mockFetch([
      {
        status: 200,
        body: JSON.stringify({
          TotalResults: 2,
          ReturnedResults: 2,
          Results: [
            { ID: 1, Name: "Zero Rated", Percentage: 0, IsDefault: false, Active: true },
            { ID: 7, Name: "Standard VAT", Percentage: 15, IsDefault: true, Active: true },
          ],
        }),
      },
    ]);
    const client = getSageOneClient({ fetchImpl: impl, minRequestIntervalMs: 0 }) as LiveSageOneClient;

    const taxTypes = await client.getTaxTypes();

    assertEquals(calls.length, 1);
    assertEquals(calls[0].init?.method, "GET");
    assertEquals(calls[0].init?.body, undefined);
    assertEquals(new URL(calls[0].url).pathname, "/api/2.0.0/TaxType/Get");
    assertEquals(taxTypes.length, 2);
    assertEquals(taxTypes[1], { id: 7, name: "Standard VAT", percentage: 15, isDefault: true, active: true });
  });
});

// ---------------------------------------------------------------------
// Error handling: rate limiting and retry classification
// ---------------------------------------------------------------------

Deno.test("429 rate limit: classified as RATE_LIMITED/retryable, but NOT retried in-process (single fetch call)", async () => {
  await withEnvAsync(FULL_VALID_ENV, async () => {
    const { impl, calls } = mockFetch([{ status: 429, body: "rate limited" }]);
    const client = getSageOneClient({ fetchImpl: impl, minRequestIntervalMs: 0 }) as LiveSageOneClient;

    const err = await assertRejects(() => client.getTaxTypes(), SageOperationError);
    assertEquals((err as SageOperationError).category, "RATE_LIMITED");
    assertEquals((err as SageOperationError).retryable, true);
    // Critical: Sage's own docs say repeated calls during a block extend
    // it — the client must not loop-retry a 429 itself.
    assertEquals(calls.length, 1);
  });
});

Deno.test("401 authentication failure: NOT retried in-process, non-retryable", async () => {
  await withEnvAsync(FULL_VALID_ENV, async () => {
    const { impl, calls } = mockFetch([{ status: 401, body: "bad credentials" }]);
    const client = getSageOneClient({ fetchImpl: impl, minRequestIntervalMs: 0 }) as LiveSageOneClient;

    const err = await assertRejects(() => client.getTaxTypes(), SageOperationError);
    assertEquals((err as SageOperationError).category, "AUTHENTICATION_ERROR");
    assertEquals((err as SageOperationError).retryable, false);
    assertEquals(calls.length, 1);
  });
});

Deno.test("400 validation failure: NOT retried in-process, non-retryable", async () => {
  await withEnvAsync(FULL_VALID_ENV, async () => {
    const { impl, calls } = mockFetch([{ status: 400, body: "bad request" }]);
    const client = getSageOneClient({ fetchImpl: impl, minRequestIntervalMs: 0 }) as LiveSageOneClient;

    const err = await assertRejects(() => client.getTaxTypes(), SageOperationError);
    assertEquals((err as SageOperationError).category, "VALIDATION_ERROR");
    assertEquals((err as SageOperationError).retryable, false);
    assertEquals(calls.length, 1);
  });
});

Deno.test("500 transient failure: retried in-process up to the bounded limit, then succeeds", async () => {
  await withEnvAsync(FULL_VALID_ENV, async () => {
    const { impl, calls } = mockFetch([
      { status: 500, body: "server error" },
      { status: 500, body: "server error" },
      { status: 200, body: JSON.stringify({ TotalResults: 0, ReturnedResults: 0, Results: [] }) },
    ]);
    const client = getSageOneClient({
      fetchImpl: impl,
      minRequestIntervalMs: 0,
      maxTransientRetries: 3,
      transientRetryBaseDelayMs: 1,
    }) as LiveSageOneClient;

    const taxTypes = await client.getTaxTypes();
    assertEquals(taxTypes, []);
    assertEquals(calls.length, 3);
  });
});

Deno.test("500 transient failure: gives up after maxTransientRetries and surfaces TRANSIENT_UPSTREAM_ERROR", async () => {
  await withEnvAsync(FULL_VALID_ENV, async () => {
    const { impl, calls } = mockFetch([
      { status: 500, body: "server error" },
      { status: 500, body: "server error" },
      { status: 500, body: "server error" },
    ]);
    const client = getSageOneClient({
      fetchImpl: impl,
      minRequestIntervalMs: 0,
      maxTransientRetries: 3,
      transientRetryBaseDelayMs: 1,
    }) as LiveSageOneClient;

    const err = await assertRejects(() => client.getTaxTypes(), SageOperationError);
    assertEquals((err as SageOperationError).category, "TRANSIENT_UPSTREAM_ERROR");
    assertEquals((err as SageOperationError).retryable, true);
    assertEquals(calls.length, 3);
  });
});

Deno.test("network error (fetch throws): treated as transient and retried in-process", async () => {
  await withEnvAsync(FULL_VALID_ENV, async () => {
    let attempts = 0;
    const impl = (() => {
      attempts++;
      if (attempts < 2) return Promise.reject(new TypeError("network down"));
      return Promise.resolve(
        new Response(JSON.stringify({ TotalResults: 0, ReturnedResults: 0, Results: [] }), { status: 200 }),
      );
    }) as typeof fetch;
    const client = getSageOneClient({
      fetchImpl: impl,
      minRequestIntervalMs: 0,
      maxTransientRetries: 3,
      transientRetryBaseDelayMs: 1,
    }) as LiveSageOneClient;

    const taxTypes = await client.getTaxTypes();
    assertEquals(taxTypes, []);
    assertEquals(attempts, 2);
  });
});

Deno.test("getInvoice returns null on a 404 (not found) instead of throwing", async () => {
  await withEnvAsync(FULL_VALID_ENV, async () => {
    const { impl } = mockFetch([{ status: 404, body: "not found" }]);
    const client = getSageOneClient({ fetchImpl: impl, minRequestIntervalMs: 0 }) as LiveSageOneClient;

    const result = await client.getInvoice("999999");
    assertEquals(result, null);
  });
});

Deno.test("authenticate() performs one read-only call and surfaces 401 as AUTHENTICATION_ERROR", async () => {
  await withEnvAsync(FULL_VALID_ENV, async () => {
    const { impl, calls } = mockFetch([{ status: 401, body: "bad credentials" }]);
    const client = getSageOneClient({ fetchImpl: impl, minRequestIntervalMs: 0 }) as LiveSageOneClient;

    const err = await assertRejects(() => client.authenticate(), SageOperationError);
    assertEquals((err as SageOperationError).category, "AUTHENTICATION_ERROR");
    assertEquals(calls.length, 1);
    assertEquals(calls[0].init?.method, "GET");
  });
});
