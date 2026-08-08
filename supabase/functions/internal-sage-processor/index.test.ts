// Run with: deno test --allow-env supabase/functions/internal-sage-processor/index.test.ts
//
// SCOPE NOTE (being explicit rather than overstating coverage):
// index.ts currently imports the live `supabaseAdmin` client directly
// (matching the existing pattern in _shared/supabase.ts, used the same
// way by every other edge function in this repo). That makes the
// claim/validate/retry/duplicate-protection code paths hard to unit-test
// without a real or injected Postgres connection. This file covers the
// one fully pure, dependency-free piece (error classification) now.
//
// Full coverage of claim/retry/duplicate-protection/concurrent-worker
// scenarios needs either a local Supabase test instance
// (supabase start + supabase test db) or refactoring index.ts to accept
// an injected DB client — flagged as a follow-up, not silently skipped.

import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { classifyError } from "./index.ts";
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
