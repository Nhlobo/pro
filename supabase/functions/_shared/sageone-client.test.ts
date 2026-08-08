// Run with: deno test --allow-env supabase/functions/_shared/sageone-client.test.ts
//
// Note: this repo has no existing edge-function test convention (no
// prior *.test.ts under supabase/functions/, and vitest is scoped to
// src/** only). These use Deno's built-in test runner, the standard
// choice for Deno-based Supabase Edge Functions. No real network calls.

import { assert, assertEquals, assertRejects } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { getSageOneClient, SageIntegrationDisabledError } from "./sageone-client.ts";

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

Deno.test("client is disabled when SAGEONE_ENABLED is unset", () => {
  withEnv({ SAGEONE_ENABLED: undefined, SAGEONE_API_URL: undefined, SAGEONE_API_KEY: undefined }, () => {
    const client = getSageOneClient();
    assertEquals(client.isConfigured, false);
    assert(client.configurationStatus.length > 0);
  });
});

Deno.test("client is disabled when credentials are missing even if enabled=true", () => {
  withEnv({ SAGEONE_ENABLED: "true", SAGEONE_API_URL: undefined, SAGEONE_API_KEY: undefined }, () => {
    const client = getSageOneClient();
    assertEquals(client.isConfigured, false);
  });
});

Deno.test("client remains disabled even with full config present (live client not implemented)", () => {
  withEnv(
    { SAGEONE_ENABLED: "true", SAGEONE_API_URL: "https://example.invalid", SAGEONE_API_KEY: "test-key" },
    () => {
      const client = getSageOneClient();
      // Intentional: presence of env vars alone must never enable real calls.
      assertEquals(client.isConfigured, false);
    },
  );
});

Deno.test("every operation throws SageIntegrationDisabledError before any network call", async () => {
  const client = getSageOneClient();

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
});
