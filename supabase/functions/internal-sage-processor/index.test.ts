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
// pieces: error classification, and single_test request validation
// (parseSingleTestRequest, which is exactly what gates entry to the
// single-record test path and is what makes "impossible to accidentally
// process the whole queue" actually true at the request-parsing layer).
//
// Full coverage of claim/retry/duplicate-protection/concurrent-worker
// scenarios (including claimSingleTestRow's row-scoping) needs either a
// local Supabase test instance (supabase start + supabase test db) or
// refactoring index.ts to accept an injected DB client — flagged as a
// follow-up, not silently skipped. The controlled sandbox test procedure
// (SANDBOX_TEST.md) covers claimSingleTestRow's actual DB behavior via a
// real manual test instead.

import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { classifyError, parseSingleTestRequest } from "./index.ts";
import { SageOperationError } from "../_shared/sageone-client.ts";

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
