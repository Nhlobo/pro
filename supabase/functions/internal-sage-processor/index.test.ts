// Run with: deno test --allow-env supabase/functions/internal-sage-processor/index.test.ts
//
// SCOPE NOTE (being explicit rather than overstating coverage):
// index.ts currently imports the live `supabaseAdmin` client directly
// (matching the existing pattern in _shared/supabase.ts, used the same
// way by every other edge function in this repo). That makes the
// claim/validate/retry/duplicate-protection code paths — including the
// DB-touching half of single_test mode (claimSingleTestRow +
// processQueueItem) — hard to unit-test without a real or injected
// Postgres connection. This file covers the fully pure, dependency-free
// pieces: error classification, single_test request validation
// (parseSingleTestRequest, which is exactly what gates entry to the
// single-record test path and is what makes "impossible to accidentally
// process the whole queue" actually true at the request-parsing layer),
// and getOrCreateSageCustomerMapping, which accepts an injectable
// SageCustomerMappingStore specifically so its reuse/create/race logic
// is fully testable without a live database (see below).
//
// Full coverage of claim/retry/duplicate-protection/concurrent-worker
// scenarios (including claimSingleTestRow's row-scoping) needs either a
// local Supabase test instance (supabase start + supabase test db) or
// refactoring index.ts to accept an injected DB client — flagged as a
// follow-up, not silently skipped. The controlled sandbox test procedure
// (SANDBOX_TEST.md) covers claimSingleTestRow's actual DB behavior via a
// real manual test instead.

import { assertEquals, assertRejects } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { classifyError, getOrCreateSageCustomerMapping, parseSingleTestRequest } from "./index.ts";
import type { SageCustomerMappingStore } from "./index.ts";
import {
  SageIntegrationDisabledError,
  SageOperationError,
  type SageCustomerInput,
  type SageCustomerResult,
  type SageInvoiceInput,
  type SageInvoiceResult,
  type SageOneClient,
  type SageTaxType,
} from "../_shared/sageone-client.ts";

Deno.test("classifyError passes through a SageOperationError's own category/retryable", () => {
  const err = new SageOperationError("RATE_LIMITED", "too many requests", true);
  const result = classifyError(err);
  assertEquals(result.category, "RATE_LIMITED");
  assertEquals(result.retryable, true);
  assertEquals(result.message, "too many requests");
});

Deno.test("classifyError treats an unrecognized error as transient/retryable by default", () => {
  const result = classifyError(new Error("ECONNRESET"));
  assertEquals(result.category, "TRANSIENT_UPSTREAM_ERROR");
  assertEquals(result.retryable, true);
});

Deno.test("classifyError handles non-Error thrown values safely", () => {
  const result = classifyError("a plain string was thrown");
  assertEquals(result.category, "TRANSIENT_UPSTREAM_ERROR");
  assertEquals(result.message, "a plain string was thrown");
});

// ---------------------------------------------------------------------
// parseSingleTestRequest — the guard that makes single_test mode safe
// ---------------------------------------------------------------------

Deno.test("parseSingleTestRequest rejects a missing confirm flag", () => {
  const result = parseSingleTestRequest({ queueId: "11111111-1111-1111-1111-111111111111" });
  assertEquals("error" in result, true);
  if ("error" in result) {
    assertEquals(result.error.includes("confirm"), true);
  }
});

Deno.test("parseSingleTestRequest rejects confirm: false", () => {
  const result = parseSingleTestRequest({ queueId: "11111111-1111-1111-1111-111111111111", confirm: false });
  assertEquals("error" in result, true);
});

Deno.test("parseSingleTestRequest rejects a missing queueId even with confirm: true", () => {
  const result = parseSingleTestRequest({ confirm: true });
  assertEquals("error" in result, true);
  if ("error" in result) {
    assertEquals(result.error.includes("queueId"), true);
  }
});

Deno.test("parseSingleTestRequest rejects a non-UUID queueId", () => {
  const result = parseSingleTestRequest({ queueId: "not-a-uuid", confirm: true });
  assertEquals("error" in result, true);
  if ("error" in result) {
    assertEquals(result.error.includes("not a valid UUID"), true);
  }
});

Deno.test("parseSingleTestRequest rejects an empty-string queueId", () => {
  const result = parseSingleTestRequest({ queueId: "", confirm: true });
  assertEquals("error" in result, true);
});

Deno.test("parseSingleTestRequest accepts a well-formed request", () => {
  const id = "11111111-1111-1111-1111-111111111111";
  const result = parseSingleTestRequest({ queueId: id, confirm: true });
  assertEquals("error" in result, false);
  if (!("error" in result)) {
    assertEquals(result.queueId, id);
  }
});

Deno.test("parseSingleTestRequest accepts a mixed-case UUID", () => {
  const id = "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE";
  const result = parseSingleTestRequest({ queueId: id, confirm: true });
  assertEquals("error" in result, false);
});

// ---------------------------------------------------------------------
// getOrCreateSageCustomerMapping — persistent referring_attorney_id ->
// sage_customer_id mapping, tested against an in-memory fake store so
// no real database is needed.
// ---------------------------------------------------------------------

const TEST_ATTORNEY = {
  id: "82f84b0c-ee3d-4758-a19c-b51c6dbea3a4",
  name: "Sengwayo Attorneys",
  contact_person: "Sinethemba Zungu",
  email: "sengwayo.inc.attorneys@gmail.com",
  phone: "035 5500430",
  address: "Office 1/3 Oriole Centre Lot 30 Jan Smuts Avenue MTUBATUBA, 3935",
};

/** In-memory stand-in for the real supabaseAdmin-backed store, with the
 * same semantics (including unique-violation recovery on insert). */
function createFakeMappingStore(initial: Record<string, string> = {}) {
  const rows = new Map(Object.entries(initial));
  const calls = { get: 0, insert: 0 };
  const store: SageCustomerMappingStore = {
    async get(referringAttorneyId: string) {
      calls.get++;
      return rows.get(referringAttorneyId) ?? null;
    },
    async insert(referringAttorneyId: string, sageCustomerId: string) {
      calls.insert++;
      if (rows.has(referringAttorneyId)) {
        // Simulates a real UNIQUE(referring_attorney_id) violation and
        // the same recovery behavior as createSupabaseSageCustomerMappingStore.
        return { inserted: false, sageCustomerId: rows.get(referringAttorneyId)! };
      }
      rows.set(referringAttorneyId, sageCustomerId);
      return { inserted: true, sageCustomerId };
    },
  };
  return { store, rows, calls };
}

/** Minimal SageOneClient fake — every method not explicitly configured
 * throws, so tests fail loudly if they accidentally exercise a path
 * they didn't intend to. */
function createFakeSageClient(overrides: Partial<SageOneClient> = {}): SageOneClient {
  const notImplemented = (method: string) => () => {
    throw new Error(`unexpected call to ${method} in this test`);
  };
  return {
    isConfigured: true,
    configurationStatus: "fake client for tests",
    authenticate: overrides.authenticate ?? notImplemented("authenticate"),
    findOrCreateCustomer: overrides.findOrCreateCustomer ?? notImplemented("findOrCreateCustomer"),
    createInvoice: overrides.createInvoice ?? notImplemented("createInvoice"),
    getInvoice: overrides.getInvoice ?? notImplemented("getInvoice"),
    getTaxTypes: overrides.getTaxTypes ?? notImplemented("getTaxTypes"),
  };
}

Deno.test("getOrCreateSageCustomerMapping: existing mapping is reused (Sage is never called)", async () => {
  const { store, calls } = createFakeMappingStore({ [TEST_ATTORNEY.id]: "501" });
  let sageCalled = false;
  const sage = createFakeSageClient({
    findOrCreateCustomer: async (_input: SageCustomerInput): Promise<SageCustomerResult> => {
      sageCalled = true;
      return { sageCustomerId: "should-not-be-used" };
    },
  });

  const result = await getOrCreateSageCustomerMapping(TEST_ATTORNEY, sage, store);

  assertEquals(result.sageCustomerId, "501");
  assertEquals(sageCalled, false, "Sage must not be called when a mapping already exists");
  assertEquals(calls.insert, 0, "no insert should happen when reusing an existing mapping");
});

Deno.test("getOrCreateSageCustomerMapping: missing mapping creates a customer and stores its ID", async () => {
  const { store, rows, calls } = createFakeMappingStore();
  let sageCallCount = 0;
  const sage = createFakeSageClient({
    findOrCreateCustomer: async (input: SageCustomerInput): Promise<SageCustomerResult> => {
      sageCallCount++;
      assertEquals(input.referringAttorneyId, TEST_ATTORNEY.id);
      assertEquals(input.name, TEST_ATTORNEY.name);
      return { sageCustomerId: "9001" };
    },
  });

  const result = await getOrCreateSageCustomerMapping(TEST_ATTORNEY, sage, store);

  assertEquals(result.sageCustomerId, "9001");
  assertEquals(sageCallCount, 1);
  assertEquals(calls.insert, 1);
  assertEquals(rows.get(TEST_ATTORNEY.id), "9001", "the mapping must actually be persisted");
});

Deno.test("getOrCreateSageCustomerMapping: failed customer creation does not create a mapping", async () => {
  const { store, rows, calls } = createFakeMappingStore();
  const sage = createFakeSageClient({
    findOrCreateCustomer: async (_input: SageCustomerInput): Promise<SageCustomerResult> => {
      throw new SageOperationError("VALIDATION_ERROR", "Sage rejected the customer", false);
    },
  });

  await assertRejects(() => getOrCreateSageCustomerMapping(TEST_ATTORNEY, sage, store), SageOperationError);

  assertEquals(calls.insert, 0, "no mapping row may be written when Sage customer creation fails");
  assertEquals(rows.has(TEST_ATTORNEY.id), false);
});

Deno.test("getOrCreateSageCustomerMapping: concurrent creation converges on one Sage customer id", async () => {
  // Simulates two overlapping invocations both seeing "no mapping yet"
  // (both call store.get() and get null before either has inserted),
  // both creating a Sage customer, and both then trying to insert. The
  // store's insert() reproduces the real UNIQUE(referring_attorney_id)
  // race: whichever insert call the fake store sees SECOND for the same
  // attorney loses and must return the winner's id instead of its own.
  const { store, rows } = createFakeMappingStore();

  // Process A creates Sage customer "111" first and wins the insert race.
  await store.insert(TEST_ATTORNEY.id, "111");

  // Process B's Sage call already happened (it also saw no mapping) and
  // returned a DIFFERENT id, "222" — simulating the real-world orphaned
  // Sage customer this race can create. Process B now attempts to
  // persist it, arriving second.
  const sageForProcessB = createFakeSageClient({
    findOrCreateCustomer: async (): Promise<SageCustomerResult> => ({ sageCustomerId: "222" }),
  });
  // Force process B through the "no mapping found yet" branch by using a
  // store whose get() still returns null once (simulating the race
  // window) but whose insert() sees the already-committed row from
  // process A — i.e. exactly what createSupabaseSageCustomerMappingStore
  // does when a real unique-violation happens.
  const racyStore: SageCustomerMappingStore = {
    get: async () => null, // process B's SELECT ran before process A's INSERT committed
    insert: store.insert, // but by the time process B's INSERT runs, A's row is already there
  };

  const resultB = await getOrCreateSageCustomerMapping(TEST_ATTORNEY, sageForProcessB, racyStore);

  assertEquals(resultB.sageCustomerId, "111", "process B must converge on the winning mapping, not its own orphaned customer");
  assertEquals(rows.get(TEST_ATTORNEY.id), "111", "exactly one mapping row must exist, and it must be the winner's");
});

Deno.test("getOrCreateSageCustomerMapping: a disabled Sage client refuses before any store mutation", async () => {
  // Defense-in-depth check: processQueueItem already guarantees
  // getOrCreateSageCustomerMapping is never called while Sage is
  // disabled (see the `!sage.isConfigured` guard above the try block).
  // This test proves the property would still hold even if that outer
  // guard were ever removed by a future change — a disabled client's
  // findOrCreateCustomer throws before returning anything, so
  // store.insert can never be reached.
  const { store, calls } = createFakeMappingStore();
  const disabledSage: SageOneClient = {
    isConfigured: false,
    configurationStatus: "SAGEONE_ENABLED is not set to 'true'.",
    authenticate: async () => {
      throw new SageIntegrationDisabledError("SAGEONE_ENABLED is not set to 'true'.");
    },
    findOrCreateCustomer: async (_input: SageCustomerInput): Promise<SageCustomerResult> => {
      throw new SageIntegrationDisabledError("SAGEONE_ENABLED is not set to 'true'.");
    },
    createInvoice: async (_input: SageInvoiceInput): Promise<SageInvoiceResult> => {
      throw new SageIntegrationDisabledError("SAGEONE_ENABLED is not set to 'true'.");
    },
    getInvoice: async (_id: string): Promise<SageInvoiceResult | null> => {
      throw new SageIntegrationDisabledError("SAGEONE_ENABLED is not set to 'true'.");
    },
    getTaxTypes: async (): Promise<SageTaxType[]> => {
      throw new SageIntegrationDisabledError("SAGEONE_ENABLED is not set to 'true'.");
    },
  };

  await assertRejects(
    () => getOrCreateSageCustomerMapping(TEST_ATTORNEY, disabledSage, store),
    SageIntegrationDisabledError,
  );
  assertEquals(calls.insert, 0, "disabled Sage must never result in a mapping write");
});
