import { describe, it, expect, beforeEach, vi } from "vitest";

// In-memory fake DB
type Row = Record<string, any>;
const db: Record<string, Row[]> = {
  aod_documents: [],
  short_term_agreements: [],
  appointments: [],
  aod_payments: [],
  expert_reports: [],
};
const updates: Array<{ table: string; id: string; patch: Row }> = [];

function reset() {
  for (const k of Object.keys(db)) db[k] = [];
  updates.length = 0;
}

// Minimal chainable query builder mimicking supabase-js for the calls used
function makeBuilder(table: string) {
  let rows: Row[] = [...db[table]];
  let mode: "select" | "update" | "insert" | "delete" = "select";
  let updatePatch: Row | null = null;
  const filters: Array<(r: Row) => boolean> = [];

  const apply = () => rows.filter((r) => filters.every((f) => f(r)));

  const exec = () => {
    if (mode === "update" && updatePatch) {
      const matched = apply();
      for (const r of matched) {
        Object.assign(r, updatePatch);
        updates.push({ table, id: r.id, patch: { ...updatePatch } });
      }
      return { data: matched, error: null };
    }
    if (mode === "insert") return { data: rows, error: null };
    return { data: apply(), error: null };
  };

  const builder: any = {
    select: (_cols?: string) => {
      mode = "select";
      return builder;
    },
    update: (patch: Row) => {
      mode = "update";
      updatePatch = patch;
      return builder;
    },
    insert: (payload: Row | Row[]) => {
      mode = "insert";
      const arr = Array.isArray(payload) ? payload : [payload];
      arr.forEach((p) => {
        const row = { id: p.id || `gen-${db[table].length + 1}`, ...p };
        db[table].push(row);
      });
      return Promise.resolve({ data: arr, error: null });
    },
    eq: (col: string, val: any) => {
      filters.push((r) => r[col] === val);
      return builder;
    },
    in: (col: string, vals: any[]) => {
      filters.push((r) => vals.includes(r[col]));
      return builder;
    },
    is: (col: string, val: any) => {
      filters.push((r) => r[col] === val);
      return builder;
    },
    order: () => builder,
    limit: (n: number) => {
      const original = apply;
      filters.push(() => true);
      // wrap apply via slice on resolution
      (builder as any)._limit = n;
      return builder;
    },
    maybeSingle: () => {
      const res = apply();
      return Promise.resolve({ data: res[0] || null, error: null });
    },
    single: () => {
      const res = apply();
      return Promise.resolve({ data: res[0] || null, error: null });
    },
    then: (resolve: any) => {
      let res = apply();
      if ((builder as any)._limit) res = res.slice(0, (builder as any)._limit);
      if (mode === "update" && updatePatch) {
        for (const r of res) {
          Object.assign(r, updatePatch);
          updates.push({ table, id: r.id, patch: { ...updatePatch } });
        }
      }
      return Promise.resolve({ data: res, error: null }).then(resolve);
    },
  };
  return builder;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => makeBuilder(table),
  },
}));

import {
  recalculateAODFromAppointments,
  recalculateShortTermFromAppointments,
} from "@/hooks/usePaymentSync";

const ATTORNEY_ID = "att-1";

beforeEach(() => reset());

describe("recalculateAODFromAppointments", () => {
  it("recomputes totals from linked appointments (service_fee, discount, deposit, status)", async () => {
    db.aod_documents.push({
      id: "aod-1",
      referring_attorney_id: ATTORNEY_ID,
      total_contract_value: 0,
      deposit_amount: 0,
      payments_made: 0,
      payment_status: "pending",
      notes: "",
      linked_appointment_ids: ["a1", "a2"],
    });
    db.appointments.push(
      {
        id: "a1",
        referring_attorney_id: ATTORNEY_ID,
        service_fee: 5000,
        discount_amount: 500,
        deposit_amount: 5000,
        payment_status: "full_payment",
        payment_date: "2026-01-15",
        payment_terms: "aod",
        deleted_at: null,
      },
      {
        id: "a2",
        referring_attorney_id: ATTORNEY_ID,
        service_fee: 3000,
        discount_amount: 0,
        deposit_amount: 1000,
        payment_status: "deposit",
        payment_date: "2026-01-20",
        payment_terms: "aod",
        deleted_at: null,
      },
    );

    await recalculateAODFromAppointments("aod-1", ATTORNEY_ID);

    const aod = db.aod_documents[0];
    expect(aod.total_contract_value).toBe(8000);
    expect(aod.discount_amount).toBe(500);
    expect(aod.deposit_amount).toBe(6000); // 5000 + min(1000,3000)
    expect(aod.payment_status).toBe("partial");
    expect(aod.total_reports_agreed).toBe(2);
    expect(aod.reports_released).toBe(1);
  });

  it("marks AOD as paid when all linked appointments are full_payment", async () => {
    db.aod_documents.push({
      id: "aod-2",
      referring_attorney_id: ATTORNEY_ID,
      total_contract_value: 0,
      deposit_amount: 0,
      payments_made: 0,
      payment_status: "pending",
      notes: "",
      linked_appointment_ids: ["b1"],
    });
    db.appointments.push({
      id: "b1",
      referring_attorney_id: ATTORNEY_ID,
      service_fee: 4000,
      discount_amount: 0,
      deposit_amount: 4000,
      payment_status: "full_payment",
      payment_date: "2026-02-01",
      payment_terms: "aod",
      deleted_at: null,
    });

    await recalculateAODFromAppointments("aod-2", ATTORNEY_ID);
    expect(db.aod_documents[0].payment_status).toBe("paid");
  });

  it("falls back to legacy aod_payments when linked_appointment_ids is empty and no matches", async () => {
    db.aod_documents.push({
      id: "aod-3",
      referring_attorney_id: ATTORNEY_ID,
      total_contract_value: 10000,
      deposit_amount: 2000,
      payments_made: 0,
      payment_status: "pending",
      notes: "",
      linked_appointment_ids: [],
    });
    // No appointments for this attorney → fallback path
    db.aod_payments.push({
      id: "p1",
      aod_document_id: "aod-3",
      payment_amount: 3000,
      payment_date: "2026-03-01",
    });

    await recalculateAODFromAppointments("aod-3", ATTORNEY_ID);

    const aod = db.aod_documents[0];
    // 2000 deposit + 3000 payment = 5000 paid → partial
    expect(aod.payment_status).toBe("partial");
    expect(aod.payments_made).toBe(3000);
  });
});

describe("recalculateShortTermFromAppointments", () => {
  it("recomputes totals from linked appointments", async () => {
    db.short_term_agreements.push({
      id: "st-1",
      referring_attorney_id: ATTORNEY_ID,
      total_contract_value: 0,
      deposit_amount: 0,
      payments_made: 0,
      payment_status: "pending",
      notes: "",
      linked_appointment_ids: ["s1", "s2"],
    });
    db.appointments.push(
      {
        id: "s1",
        referring_attorney_id: ATTORNEY_ID,
        service_fee: 2000,
        discount_amount: 200,
        deposit_amount: 2000,
        payment_status: "full_payment",
        payment_date: "2026-01-10",
        payment_terms: "short-term",
        deleted_at: null,
      },
      {
        id: "s2",
        referring_attorney_id: ATTORNEY_ID,
        service_fee: 2500,
        discount_amount: 0,
        deposit_amount: 0,
        payment_status: "pending",
        payment_date: null,
        payment_terms: "short-term",
        deleted_at: null,
      },
    );

    await recalculateShortTermFromAppointments("st-1", ATTORNEY_ID);

    const st = db.short_term_agreements[0];
    expect(st.total_contract_value).toBe(4500);
    expect(st.discount_amount).toBe(200);
    expect(st.deposit_amount).toBe(2000);
    expect(st.payment_status).toBe("partial");
    expect(st.reports_completed).toBe(1);
    expect(st.total_reports_agreed).toBe(2);
  });

  it("falls back when linked_appointment_ids is empty", async () => {
    db.short_term_agreements.push({
      id: "st-2",
      referring_attorney_id: ATTORNEY_ID,
      total_contract_value: 5000,
      deposit_amount: 1000,
      payments_made: 1000,
      payment_status: "pending",
      notes: "",
      linked_appointment_ids: [],
    });
    // No appointments at all for attorney → fallback path (no linked appts)
    await recalculateShortTermFromAppointments("st-2", ATTORNEY_ID);
    // 1000 + 1000 = 2000 < 5000 → partial
    expect(db.short_term_agreements[0].payment_status).toBe("partial");
  });

  it("reflects an updated service_fee in real time on next recalc", async () => {
    db.short_term_agreements.push({
      id: "st-3",
      referring_attorney_id: ATTORNEY_ID,
      total_contract_value: 0,
      deposit_amount: 0,
      payments_made: 0,
      payment_status: "pending",
      notes: "",
      linked_appointment_ids: ["x1"],
    });
    db.appointments.push({
      id: "x1",
      referring_attorney_id: ATTORNEY_ID,
      service_fee: 1000,
      discount_amount: 0,
      deposit_amount: 0,
      payment_status: "pending",
      payment_date: null,
      payment_terms: "short-term",
      deleted_at: null,
    });

    await recalculateShortTermFromAppointments("st-3", ATTORNEY_ID);
    expect(db.short_term_agreements[0].total_contract_value).toBe(1000);

    // Edit appointment fee → recalc should update
    db.appointments[0].service_fee = 7500;
    db.appointments[0].discount_amount = 500;
    db.appointments[0].deposit_amount = 7500;
    db.appointments[0].payment_status = "full_payment";

    await recalculateShortTermFromAppointments("st-3", ATTORNEY_ID);
    const st = db.short_term_agreements[0];
    expect(st.total_contract_value).toBe(7500);
    expect(st.discount_amount).toBe(500);
    expect(st.deposit_amount).toBe(7500);
    expect(st.payment_status).toBe("paid");
  });
});
