/**
 * AOD lifecycle classification rules.
 *
 * These rules drive how each attorney's AOD agreement is classified as
 * Active, Dormant, or Closed in the AOD Grouped View. They are persisted in
 * `system_settings` under the key below and are user-editable via
 * `AODLifecycleRulesEditor`. Each save bumps `version` so any displayed
 * classification can be traced to the rules in force at the time.
 */

export const AOD_LIFECYCLE_RULES_KEY = "aod_lifecycle_rules";

export interface AODLifecycleRules {
  /** Monotonically increasing rule version. Bumped on every save. */
  version: number;
  /** No payments and no reports for this many days → Dormant. */
  dormancy_days: number;
  /** Difference between AOD total and assessment fees ≤ this is treated as in-sync (R). */
  rounding_tolerance: number;
  /** Outstanding balance ≤ this counts as fully paid (R). */
  fully_paid_threshold: number;
  /** Minimum reports released required to qualify as Closed. */
  min_reports_for_closed: number;
  /** When true, Closed also requires reports_released ≥ total_reports_agreed. */
  require_all_reports_for_closed: boolean;
}

export const DEFAULT_AOD_LIFECYCLE_RULES: AODLifecycleRules = {
  version: 1,
  dormancy_days: 90,
  rounding_tolerance: 1,
  fully_paid_threshold: 0.01,
  min_reports_for_closed: 1,
  require_all_reports_for_closed: true,
};

export type LifecycleStatus = "active" | "dormant" | "closed";

export interface ClassificationInput {
  outstanding_balance: number;
  total_reports_agreed: number;
  total_reports_released: number;
  /** ISO date string of last activity (max of last payment / last assessment), or null. */
  last_activity_date: string | null;
  /** Whether the attorney has at least one scheduled/assessed appointment. */
  has_assessment: boolean;
  /** Optional clock for testing. */
  now?: Date;
}

/**
 * Classify a single attorney's aggregated AOD position against the supplied rules.
 * Returns both the status and the rule version used so callers can display it.
 */
export const classifyAODLifecycle = (
  input: ClassificationInput,
  rules: AODLifecycleRules
): { status: LifecycleStatus; rules_version: number; days_inactive: number | null } => {
  const now = (input.now ?? new Date()).getTime();
  const daysInactive = input.last_activity_date
    ? Math.floor((now - new Date(input.last_activity_date).getTime()) / 86400000)
    : null;

  const fullyPaid = input.outstanding_balance <= rules.fully_paid_threshold;
  const enoughReports = input.total_reports_released >= rules.min_reports_for_closed;
  const allReports =
    !rules.require_all_reports_for_closed ||
    (input.total_reports_agreed > 0 &&
      input.total_reports_released >= input.total_reports_agreed);

  let status: LifecycleStatus = "active";

  if (fullyPaid && enoughReports && allReports) {
    status = "closed";
  } else if (
    !fullyPaid &&
    input.has_assessment &&
    daysInactive !== null &&
    daysInactive > rules.dormancy_days
  ) {
    status = "dormant";
  } else {
    status = "active";
  }

  return { status, rules_version: rules.version, days_inactive: daysInactive };
};
