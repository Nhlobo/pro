// Keep this in sync with the full internal-staff role set (see
// create-user/index.ts's validRoles and the CASE ranking in
// get_current_user_role()) plus the two external-portal roles. A staff
// role missing here isn't a routing bug like getDashboardPathForRole's
// default case covers -- it fails isValidPortalRole() entirely, which
// Auth.tsx treats as "Access not authorized" and signs the person back
// out on every login. 'finance' and 'director' were missing until this
// fix (2026-08-30), which silently locked those staff out of the
// internal system.
export const PORTAL_ROLES = [
  'admin',
  'employee',
  'sales_consultant',
  'finance',
  'director',
  'referring_attorney',
  'medical_expert',
] as const;

export type PortalRole = (typeof PORTAL_ROLES)[number];

export const isValidPortalRole = (role?: string | null): boolean =>
  !!role && (PORTAL_ROLES as readonly string[]).includes(role);

export const getDashboardPathForRole = (
  role?: string | null,
  userType?: string | null
): string => {
  const r = role || userType || '';
  switch (r) {
    case 'referring_attorney':
      return '/attorney-portal';
    case 'medical_expert':
      return '/expert-portal';
// AFTER
default:
  // admin / employee / sales_consultant / unknown all land on the
  // main dashboard. This must never be '/' — root is a hard redirect
  // to /auth (see App.tsx) — or a fresh login bounces back to sign-in.
  return '/dashboard';
  
  }
};
