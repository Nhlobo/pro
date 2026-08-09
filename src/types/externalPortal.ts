/**
 * External Portal Module — shared types.
 *
 * Isolated from the generated `src/integrations/supabase/types.ts` on
 * purpose: that file is auto-generated from the main schema and this
 * module's tables (`external_portal_*`) won't appear in it until
 * `supabase gen types` is re-run against a database that has this
 * migration applied. Until then, the hooks in this module query with
 * `.from('external_portal_accounts' as any)` and rely on these
 * hand-written types for compile-time safety in the app layer.
 *
 * Once codegen is refreshed, these types can be swapped for the
 * generated `Tables<'external_portal_accounts'>` equivalents with no
 * other changes required — every consumer imports from this file.
 */

export type ExternalPortalType = 'attorney' | 'expert';

export type ExternalPortalAccountStatus = 'active' | 'paused' | 'expired' | 'deleted';

export type ExternalPortalLinkStatus = 'pending' | 'used' | 'expired' | 'revoked';

export type ExternalPortalOtpPurpose = 'registration' | 'login';

export interface ExternalPortalAccount {
  id: string;
  portal_type: ExternalPortalType;
  full_name: string;
  email: string;
  phone: string | null;
  referring_attorney_id: string | null;
  medical_expert_id: string | null;
  /** The real auth.users row bridged to this account on first login. Null until they've signed in at least once. */
  auth_user_id: string | null;
  status: ExternalPortalAccountStatus;
  paused_at: string | null;
  paused_reason: string | null;
  expired_at: string | null;
  expired_reason: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  registered_at: string | null;
  last_login_at: string | null;
  last_login_ip: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Account row enriched with fields the list/detail views need, joined client-side. */
export interface ExternalPortalAccountWithMeta extends ExternalPortalAccount {
  /**
   * Whether this account has completed the login bridge at least once
   * (has a real auth.users row provisioned). Replaces the old
   * linked_case_count/open_case_count/active_access_link fields —
   * those tracked the now-retired admin-curated case-links list;
   * access is now identity-based (referring_attorney_id / expert_id +
   * RLS), same as every staff attorney/expert login, so there's
   * nothing case-by-case left to show here.
   */
  is_bridged: boolean;
  active_access_link: boolean;
}

export interface ExternalPortalCaseLink {
  id: string;
  account_id: string;
  appointment_id: string;
  granted_by: string | null;
  granted_at: string;
  revoked_at: string | null;
}

export interface ExternalPortalAccessLink {
  id: string;
  account_id: string;
  token_hash: string;
  status: ExternalPortalLinkStatus;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
  created_by: string | null;
  created_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

export interface ExternalPortalSession {
  id: string;
  account_id: string;
  created_at: string;
  expires_at: string;
  last_seen_at: string;
  revoked_at: string | null;
  revoked_reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
}

export interface ExternalPortalOtpCode {
  id: string;
  account_id: string;
  access_link_id: string | null;
  purpose: ExternalPortalOtpPurpose;
  destination: string;
  attempts: number;
  max_attempts: number;
  expires_at: string;
  verified_at: string | null;
  created_at: string;
}

export interface ExternalPortalLoginHistoryEntry {
  id: string;
  account_id: string | null;
  email_attempted: string | null;
  event_type: string;
  success: boolean;
  failure_reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  occurred_at: string;
}

export interface ExternalPortalAuditLogEntry {
  id: string;
  actor_type: 'admin' | 'system' | 'external_user';
  actor_id: string | null;
  account_id: string | null;
  action: string;
  details: Record<string, unknown>;
  ip_address: string | null;
  occurred_at: string;
}

export interface ExternalPortalSettings {
  id: 1;
  access_link_expiry_hours: number;
  otp_length: number;
  otp_expiry_minutes: number;
  otp_max_attempts: number;
  session_expiry_hours: number;
  auto_expire_on_all_cases_closed: boolean;
  updated_by: string | null;
  updated_at: string;
}

export const PORTAL_TYPE_LABEL: Record<ExternalPortalType, string> = {
  attorney: 'Referring Attorney',
  expert: 'Medical Expert',
};

export const ACCOUNT_STATUS_LABEL: Record<ExternalPortalAccountStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  expired: 'Expired',
  deleted: 'Deleted',
};

export const ACCOUNT_STATUS_TONE: Record<ExternalPortalAccountStatus, 'teal' | 'success' | 'neutral' | 'warning' | 'destructive'> = {
  active: 'success',
  paused: 'warning',
  expired: 'destructive',
  deleted: 'destructive',
};
