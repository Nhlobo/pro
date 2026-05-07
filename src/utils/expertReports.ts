import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

/**
 * Validation + safe upsert helpers for the `expert_reports` table.
 *
 * The database enforces a unique partial index on (appointment_id) where
 * appointment_id IS NOT NULL. These helpers provide matching client-side
 * validation so duplicate transactions are blocked BEFORE the request
 * leaves the browser, with the DB constraint as the server-side safety net.
 */

export const expertReportInsertSchema = z.object({
  appointment_id: z.string().uuid().nullable().optional(),
  expert_id: z.string().uuid({ message: "Valid expert is required" }),
  claimant_id: z.string().uuid({ message: "Valid claimant is required" }),
  report_status: z.string().trim().min(1).max(100).optional(),
  report_submitted_date: z.string().optional(),
  payment_status: z.string().trim().max(50).optional(),
  payment_date: z.string().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  updated_at: z.string().optional(),
});

export type ExpertReportInsert = z.infer<typeof expertReportInsertSchema>;

export interface UpsertResult {
  ok: boolean;
  action: "inserted" | "updated" | "skipped";
  id?: string;
  error?: string;
}

/**
 * Validate input + ensure exactly one expert_reports row exists per
 * appointment. If a row already exists for the given appointment_id, it is
 * UPDATED instead of inserting a duplicate. Rows without an appointment_id
 * are always inserted (no uniqueness rule applies).
 */
export const upsertExpertReport = async (
  input: ExpertReportInsert,
): Promise<UpsertResult> => {
  // 1. Client-side validation
  const parsed = expertReportInsertSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      action: "skipped",
      error: parsed.error.errors.map((e) => e.message).join("; "),
    };
  }
  const data = parsed.data;

  // 2. Duplicate guard for appointment-linked reports
  if (data.appointment_id) {
    const { data: existing, error: lookupErr } = await supabase
      .from("expert_reports")
      .select("id")
      .eq("appointment_id", data.appointment_id)
      .limit(1);

    if (lookupErr) {
      return { ok: false, action: "skipped", error: lookupErr.message };
    }

    if (existing && existing.length > 0) {
      const id = existing[0].id;
      const { error: updateErr } = await supabase
        .from("expert_reports")
        .update({
          report_status: data.report_status,
          report_submitted_date: data.report_submitted_date,
          payment_status: data.payment_status,
          payment_date: data.payment_date,
          notes: data.notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (updateErr) {
        return { ok: false, action: "skipped", error: updateErr.message };
      }
      return { ok: true, action: "updated", id };
    }
  }

  // 3. Safe insert (server still enforces the partial unique index)
  const { data: inserted, error: insertErr } = await supabase
    .from("expert_reports")
    .insert({
      appointment_id: data.appointment_id ?? null,
      expert_id: data.expert_id,
      claimant_id: data.claimant_id,
      report_status: data.report_status,
      report_submitted_date: data.report_submitted_date,
      payment_status: data.payment_status,
      payment_date: data.payment_date,
      notes: data.notes,
      updated_at: data.updated_at ?? new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertErr) {
    // Postgres unique-violation code (23505) — surfaced if a race slipped past
    // the pre-check. Translate into an "updated" outcome.
    if ((insertErr as any).code === "23505" && data.appointment_id) {
      const { data: existingRow } = await supabase
        .from("expert_reports")
        .select("id")
        .eq("appointment_id", data.appointment_id)
        .limit(1)
        .maybeSingle();
      if (existingRow) {
        await supabase
          .from("expert_reports")
          .update({
            report_status: data.report_status,
            report_submitted_date: data.report_submitted_date,
            notes: data.notes,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingRow.id);
        return { ok: true, action: "updated", id: existingRow.id };
      }
    }
    return { ok: false, action: "skipped", error: insertErr.message };
  }

  return { ok: true, action: "inserted", id: inserted?.id };
};
