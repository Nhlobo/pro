/**
 * Integration tests against LIVE Supabase Edge Functions.
 *
 * Run explicitly:    bun run test:integration
 * Skip in unit runs: excluded by vitest.config.ts.
 *
 * These tests use the anon key only — no privileged operations are executed.
 * They verify shape, status codes, and the shared error envelope contract.
 */
import { describe, it, expect } from "vitest";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? "https://zybkhhxvsdjkluqydcbb.supabase.co";
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";

const fn = (path: string) => `${SUPABASE_URL}/functions/v1/${path.replace(/^\//, "")}`;

const callJson = async (
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: any; raw: string }> => {
  const res = await fetch(fn(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      ...(init.headers || {}),
    },
  });
  const raw = await res.text();
  let body: any = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = raw;
  }
  return { status: res.status, body, raw };
};

describe("edge functions — integration", () => {
  it("CORS preflight returns 200 with allow-origin", async () => {
    const res = await fetch(fn("validate-access-code"), { method: "OPTIONS" });
    await res.text();
    expect([200, 204]).toContain(res.status);
    expect(res.headers.get("access-control-allow-origin")).toBeTruthy();
  });

  it("validate-access-code rejects an invalid code with structured envelope", async () => {
    const { status, body } = await callJson("validate-access-code", {
      method: "POST",
      body: JSON.stringify({ code: "INVALIDCODE0" }),
    });
    expect([400, 401, 403, 404]).toContain(status);
    expect(body).toBeTruthy();
    // Either { success:false, error:{...} } or { error: "..." } legacy shape.
    const hasEnvelope =
      (body?.success === false && typeof body?.error === "object") ||
      typeof body?.error === "string";
    expect(hasEnvelope).toBe(true);
  });

  it("validate-access-code with empty body returns a client error (no 5xx)", async () => {
    const { status } = await callJson("validate-access-code", {
      method: "POST",
      body: JSON.stringify({}),
    });
    expect(status).toBeGreaterThanOrEqual(400);
    expect(status).toBeLessThan(500);
  });

  it("validate-expert-access-code rejects an invalid expert code", async () => {
    const { status, body } = await callJson("validate-expert-access-code", {
      method: "POST",
      body: JSON.stringify({ code: "INVALIDEXPRT" }),
    });
    expect(status).toBeGreaterThanOrEqual(400);
    expect(body).toBeTruthy();
  });

  it("unknown route returns 404", async () => {
    const res = await fetch(fn("definitely-not-a-real-function"), {
      method: "POST",
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    });
    await res.text();
    expect(res.status).toBe(404);
  });

  it("missing apikey is rejected by gateway", async () => {
    const res = await fetch(fn("validate-access-code"), {
      method: "POST",
      body: JSON.stringify({ code: "x" }),
      headers: { "Content-Type": "application/json" },
    });
    await res.text();
    expect([401, 403]).toContain(res.status);
  });
});
