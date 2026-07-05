export const PORTAL_ROLES = [
  'admin',
  'employee',
  'sales_consultant',
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
