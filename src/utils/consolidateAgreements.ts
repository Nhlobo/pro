import { supabase } from "@/integrations/supabase/client";
import {
  recalculateAODFromAppointments,
  recalculateShortTermFromAppointments,
} from "@/hooks/usePaymentSync";

export type ConsolidationResult = {
  attorneysProcessed: number;
  aodMerged: number;
  aodKept: number;
  shortTermMerged: number;
  shortTermKept: number;
  appointmentsLinked: number;
  errors: string[];
};

/**
 * One-click consolidation:
 * For every non-system referring attorney with duplicate aod_documents OR
 * short_term_agreements, merge duplicates into the earliest record, link ALL
 * relevant appointments, and trigger a real-time recalculation so totals,
 * discounts, payments and statuses are refreshed from live appointment data.
 *
 * Pass `attorneyId` to scope to a single attorney.
 */
export const consolidateDuplicateAgreements = async (
  attorneyId?: string
): Promise<ConsolidationResult> => {
  const result: ConsolidationResult = {
    attorneysProcessed: 0,
    aodMerged: 0,
    aodKept: 0,
    shortTermMerged: 0,
    shortTermKept: 0,
    appointmentsLinked: 0,
    errors: [],
  };

  try {
    // Fetch eligible referring attorneys (exclude system companies)
    let attorneyQuery = supabase
      .from("referring_attorneys")
      .select("id, name, is_system_company");
    if (attorneyId) attorneyQuery = attorneyQuery.eq("id", attorneyId);

    const { data: attorneys, error: attorneyErr } = await attorneyQuery;
    if (attorneyErr) throw attorneyErr;

    const targets = (attorneys || []).filter((a: any) => !a.is_system_company);

    for (const att of targets) {
      result.attorneysProcessed++;

      // Pull all appointments for this attorney (active only)
      const { data: appts } = await supabase
        .from("appointments")
        .select("id, payment_terms, appointment_date")
        .eq("referring_attorney_id", att.id)
        .is("deleted_at", null)
        .in("case_status", ["scheduled", "assessed"]);

      const allApptIds = (appts || []).map((a) => a.id);
      const shortTermApptIds = (appts || [])
        .filter((a: any) =>
          ["30-days", "60-days", "90-days", "1-month", "2-month", "3-month", "6-month"]
            .some((t) => (a.payment_terms || "").includes(t))
        )
        .map((a) => a.id);
      const aodApptIds = allApptIds.filter((id) => !shortTermApptIds.includes(id));

      // ===== AOD consolidation =====
      const { data: aods } = await supabase
        .from("aod_documents")
        .select("id, created_at, notes, linked_appointment_ids")
        .eq("referring_attorney_id", att.id)
        .order("created_at", { ascending: true });

      if (aods && aods.length > 0) {
        const master = aods[0];
        const dupes = aods.slice(1);

        // Union of appointment IDs from notes + linked_appointment_ids columns + AOD-eligible appts
        const collected = new Set<string>(aodApptIds);
        for (const d of aods) {
          ((d as any).linked_appointment_ids || []).forEach((id: string) => collected.add(id));
          const matches = (d.notes || "").match(/APPOINTMENT:([a-f0-9-]+)/gi);
          (matches || []).forEach((m) => collected.add(m.replace(/APPOINTMENT:/i, "")));
        }
        const linkedIds = Array.from(collected);

        // Move any aod_payments from duplicates to the master
        if (dupes.length > 0) {
          await supabase
            .from("aod_payments")
            .update({ aod_document_id: master.id })
            .in(
              "aod_document_id",
              dupes.map((d) => d.id)
            );

          await supabase
            .from("aod_documents")
            .delete()
            .in(
              "id",
              dupes.map((d) => d.id)
            );
          result.aodMerged += dupes.length;
        }

        await supabase
          .from("aod_documents")
          .update({
            linked_appointment_ids: linkedIds,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", master.id);

        result.appointmentsLinked += linkedIds.length;
        result.aodKept++;

        await recalculateAODFromAppointments(master.id, att.id);
      }

      // ===== Short-term consolidation =====
      const { data: stAgs } = await supabase
        .from("short_term_agreements")
        .select("id, created_at, notes, linked_appointment_ids")
        .eq("referring_attorney_id", att.id)
        .order("created_at", { ascending: true });

      if (stAgs && stAgs.length > 0) {
        const master = stAgs[0];
        const dupes = stAgs.slice(1);

        const collected = new Set<string>(shortTermApptIds);
        for (const d of stAgs) {
          ((d as any).linked_appointment_ids || []).forEach((id: string) => collected.add(id));
          const matches = (d.notes || "").match(/APPOINTMENT:([a-f0-9-]+)/gi);
          (matches || []).forEach((m) => collected.add(m.replace(/APPOINTMENT:/i, "")));
        }
        const linkedIds = Array.from(collected);

        if (dupes.length > 0) {
          await supabase
            .from("short_term_agreements")
            .delete()
            .in(
              "id",
              dupes.map((d) => d.id)
            );
          result.shortTermMerged += dupes.length;
        }

        await supabase
          .from("short_term_agreements")
          .update({
            linked_appointment_ids: linkedIds,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", master.id);

        result.shortTermKept++;

        await recalculateShortTermFromAppointments(master.id, att.id);
      }
    }
  } catch (e: any) {
    result.errors.push(e.message || String(e));
  }

  return result;
};
