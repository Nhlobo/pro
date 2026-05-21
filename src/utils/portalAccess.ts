/**
 * Pure helpers describing which portal each role is allowed to access.
 *
 * These rules MUST stay in sync with the redirect logic in:
 *  - src/components/portal/AdminPortalLayout.tsx
 *  - src/hooks/usePermissions.tsx
 *
 * Keeping the rules here lets us unit-test them deterministically without
 * mounting the full router / Supabase stack.
 */

export type AppRole =
  | 'admin'
  | 'employee'
  | 'sales_consultant'
  | 'medical_expert'
  | 'referring_attorney'
  | 'finance'
  | 'director'
  | 'user'
  | null
  | undefined;

export type Portal = 'admin' | 'expert' | 'attorney' | 'dashboard';

/** Routes a sales_consultant is permitted to view inside the admin portal. */
export const SALES_CONSULTANT_ALLOWED_ADMIN_ROUTES = [
  '/admin/appointments',
  '/admin/finance',
  '/admin/attorney-crm',
  '/admin/heatmap',
  '/admin/my-profile',
] as const;

/** Default landing route for a role on sign-in. */
export const getDefaultPortalRoute = (role: AppRole): string => {
  switch (role) {
    case 'admin':
    case 'employee':
      return '/admin';
    case 'sales_consultant':
      return '/admin/appointments';
    case 'medical_expert':
      return '/expert-portal';
    case 'referring_attorney':
      return '/attorney-portal';
    default:
      return '/dashboard';
  }
};

/** Full admin-portal access (every /admin/* page, including IAM and System Control). */
export const hasFullAdminAccess = (role: AppRole): boolean =>
  role === 'admin' || role === 'employee';

/**
 * Returns true if the role may render the requested path within the admin
 * portal layout. Only admins/employees get unrestricted access; sales
 * consultants are limited to SALES_CONSULTANT_ALLOWED_ADMIN_ROUTES; everyone
 * else is denied.
 */
/** Admin-only admin-portal routes — company employees are excluded. */
export const ADMIN_ONLY_ADMIN_ROUTES = [
  '/admin/analytics',
  '/admin/iam',
  '/admin/system-control',
] as const;

const matchesPath = (target: string, pathname: string) =>
  pathname === target || pathname.startsWith(target + '/');

/**
 * Returns true if the role may render the requested path within the admin
 * portal layout. Admins get unrestricted access; employees get everything
 * except ADMIN_ONLY_ADMIN_ROUTES; sales consultants are limited to
 * SALES_CONSULTANT_ALLOWED_ADMIN_ROUTES; everyone else is denied.
 */
export const canAccessAdminRoute = (role: AppRole, pathname: string): boolean => {
  if (role === 'admin') return true;
  if (role === 'employee') {
    return !ADMIN_ONLY_ADMIN_ROUTES.some((p) => matchesPath(p, pathname));
  }
  if (role === 'sales_consultant') {
    return SALES_CONSULTANT_ALLOWED_ADMIN_ROUTES.some((p) => matchesPath(p, pathname));
  }
  return false;
};

/**
 * Where to redirect a user that lands on an admin route they cannot access.
 * Returns null when no redirect is needed (i.e. access is allowed).
 */
export const adminRouteRedirect = (
  role: AppRole,
  pathname: string,
): string | null => {
  if (hasFullAdminAccess(role)) return null;
  if (role === 'sales_consultant') {
    return canAccessAdminRoute(role, pathname) ? null : '/admin/appointments';
  }
  return '/dashboard';
};

/** True iff the role can render anything inside the expert portal. */
export const canAccessExpertPortal = (role: AppRole): boolean =>
  role === 'medical_expert' || hasFullAdminAccess(role);

/** True iff the role can render anything inside the attorney portal. */
export const canAccessAttorneyPortal = (role: AppRole): boolean =>
  role === 'referring_attorney' || hasFullAdminAccess(role);
