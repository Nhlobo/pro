/**
 * Single source of truth for turning a "Terms of Payment" selection into an
 * agreement classification.
 *
 * The "Terms of Payment" dropdown on the New Appointment form uses these
 * exact values (see NewAppointment.tsx):
 *   "aod" | "short-term" | "30-days" | "60-days" | "90-days" | "immediate"
 *
 * Previously, classification logic elsewhere matched against strings like
 * "30 days" (with a space) or "6 months" / "12 months" (which are not
 * dropdown options at all), so real selections never matched and deals
 * silently fell through without being routed to either an AOD document or
 * a Short-Term Agreement. This helper matches the actual dropdown values.
 */

export type PaymentTermsClassification = "immediate" | "short-term" | "aod";

/** Day-based short-term options map to a default agreement length in months. */
export const DAY_TERM_DEFAULT_DURATION_MONTHS: Record<string, number> = {
  "30-days": 1,
  "60-days": 2,
  "90-days": 3,
};

export const isDayBasedShortTermTerm = (paymentTerms?: string | null): boolean => {
  const terms = (paymentTerms || "").toLowerCase().trim();
  return terms in DAY_TERM_DEFAULT_DURATION_MONTHS;
};

/**
 * Resolve the effective agreement duration in months for a given selection.
 * If the user explicitly entered a duration, that value wins. Otherwise,
 * day-based terms (30/60/90 days) get a sensible default so the record
 * saved to the database is meaningful for reporting.
 */
export const resolveAgreementDurationMonths = (
  paymentTerms?: string | null,
  explicitDurationMonths?: number | string | null
): number => {
  const explicit =
    explicitDurationMonths === null || explicitDurationMonths === undefined || explicitDurationMonths === ""
      ? 0
      : Number(explicitDurationMonths) || 0;
  if (explicit > 0) return explicit;

  const terms = (paymentTerms || "").toLowerCase().trim();
  if (terms in DAY_TERM_DEFAULT_DURATION_MONTHS) {
    return DAY_TERM_DEFAULT_DURATION_MONTHS[terms];
  }
  return 0;
};

/**
 * Classify a Terms-of-Payment selection into "immediate" (no agreement
 * needed), "short-term" (< 12 months, routes to short_term_agreements), or
 * "aod" (>= 12 months / standard AOD, routes to aod_documents).
 */
export const classifyPaymentTerms = (
  paymentTerms?: string | null,
  explicitDurationMonths?: number | string | null
): PaymentTermsClassification => {
  const terms = (paymentTerms || "").toLowerCase().trim();
  if (!terms) return "aod"; // default/legacy behaviour: unset terms fall back to AOD handling

  if (terms === "immediate") return "immediate";

  // Explicit short-term selection or a day-based term (30/60/90 days) is
  // always short-term, regardless of whether a duration was typed in.
  if (terms === "short-term" || terms in DAY_TERM_DEFAULT_DURATION_MONTHS) {
    return "short-term";
  }

  const duration = resolveAgreementDurationMonths(paymentTerms, explicitDurationMonths);

  if (terms === "aod") {
    // AOD explicitly chosen, but someone typed a duration under 12 months
    // in the Agreement Duration field -> still treat as short-term so the
    // reporting/short-term list stays accurate.
    return duration > 0 && duration < 12 ? "short-term" : "aod";
  }

  // Fallback for any other free-text value: use duration if provided.
  if (duration > 0 && duration < 12) return "short-term";
  return "aod";
};

/** True if this classification requires ANY formal agreement record. */
export const requiresAgreementRecord = (classification: PaymentTermsClassification): boolean =>
  classification !== "immediate";
