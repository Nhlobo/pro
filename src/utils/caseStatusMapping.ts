/**
 * Single source of truth for appointments.case_status values.
 *
 * The DB constraint `appointments_case_status_check` is case-sensitive, so the
 * UI must always convert the user's selection to the EXACT allowed casing
 * before saving — and convert it back to a friendly UI label when displaying.
 */

// DB → UI label. The keys MUST exactly match the DB check constraint values.
export const CASE_STATUS_DB_TO_UI: Record<string, string> = {
  scheduled: 'Scheduled',
  assessed: 'Assessed',
  're-assessed': 'Re-Assessed',
  cancelled: 'Cancelled',
  rescheduled: 'Rescheduled',
  assessment_scheduled: 'Assessment Scheduled',
  assessment_completed: 'Assessment Completed',
  report_in_progress: 'Report in Progress',
  report_submitted: 'Report Submitted',
  'report submitted': 'Report Submitted',
  report_delivered: 'Report Delivered',
  under_review: 'Under Review',
  revision_requested: 'Revision Requested',
  finalised: 'Finalised',
  closed: 'Closed',
  'Joint Minutes': 'Joint Minutes',
  Addendum: 'Addendum',
  Affidavits: 'Affidavits',
  'Court Preparation': 'Court Preparation',
  'Court Attendance': 'Court Attendance',
  'Merit Report': 'Merit Report',
};

// All values allowed by the DB check constraint, in their exact casing.
export const ALLOWED_DB_CASE_STATUSES = Object.keys(CASE_STATUS_DB_TO_UI);

/**
 * Convert any user-entered status (any casing, spaces or underscores) to the
 * exact DB-allowed value. Returns null when no whitelist entry matches.
 */
export function toDbCaseStatus(input: string | null | undefined): string | null {
  if (!input) return null;
  const normalised = input.trim().toLowerCase().replace(/_/g, ' ');
  for (const allowed of ALLOWED_DB_CASE_STATUSES) {
    if (allowed.toLowerCase().replace(/_/g, ' ') === normalised) {
      return allowed;
    }
  }
  return null;
}

/**
 * Convert a DB-stored value to the friendly UI label used in tables and selects.
 */
export function toUiCaseStatus(dbValue: string | null | undefined): string {
  if (!dbValue) return 'Scheduled';
  if (CASE_STATUS_DB_TO_UI[dbValue]) return CASE_STATUS_DB_TO_UI[dbValue];
  // Case-insensitive fallback against the whitelist.
  const matched = ALLOWED_DB_CASE_STATUSES.find(
    s => s.toLowerCase() === dbValue.toLowerCase(),
  );
  if (matched) return CASE_STATUS_DB_TO_UI[matched];
  // Last-resort title-case fallback.
  return dbValue
    .replace(/_/g, ' ')
    .split(' ')
    .map(w => w.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('-'))
    .join(' ');
}
