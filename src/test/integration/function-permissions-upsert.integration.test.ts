/**
 * Integration test: bulk Save changes upsert for function_permissions.
 *
 * Guards against regression of the duplicate-row bug where NULL `sub_function`
 * values were treated as distinct by a unique index, causing the bulk
 * "Save changes" action to fail with a unique-constraint / upsert error.
 *
 * Invokes the SECURITY DEFINER self-test RPC `test_function_permissions_upsert`,
 * which performs the same INSERT ... ON CONFLICT used by
 * `bulk_update_function_permissions` for both:
 *   1. sub_function IS NULL  (twice — must UPDATE, not duplicate)
 *   2. sub_function = '...'  (twice — must UPDATE, not duplicate)
 * and verifies the two cases coexist as 2 distinct rows.
 *
 * Run explicitly:  bun run test:integration
 */
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? "https://zybkhhxvsdjkluqydcbb.supabase.co";
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";

describe("bulk_update_function_permissions — upsert safety", () => {
  const supabase = createClient(SUPABASE_URL, ANON_KEY);

  it("upserts a single row when sub_function is NULL (no duplicates)", async () => {
    const { data, error } = await supabase.rpc("test_function_permissions_upsert");
    expect(error, error?.message).toBeNull();
    expect(data).toBeTruthy();
    expect((data as any).ok).toBe(true);
    expect((data as any).null_case_rows).toBe(1);
  });

  it("upserts a single row when sub_function has a value (no duplicates)", async () => {
    const { data, error } = await supabase.rpc("test_function_permissions_upsert");
    expect(error, error?.message).toBeNull();
    expect((data as any).valued_case_rows).toBe(1);
  });

  it("is idempotent across repeated invocations (cleanup works)", async () => {
    for (let i = 0; i < 3; i++) {
      const { data, error } = await supabase.rpc("test_function_permissions_upsert");
      expect(error, `iteration ${i}: ${error?.message}`).toBeNull();
      expect((data as any).ok).toBe(true);
    }
  });
});
