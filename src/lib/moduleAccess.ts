import { PREDEFINED_FUNCTIONS } from '@/hooks/useFunctionPermissions';
import type { AdminModule } from '@/config/adminModules';

/**
 * Single source of truth for "does this set of function_permissions rows
 * grant this module." Used by:
 *  - FunctionPermissionsManager (admin editing another user's grants)
 *  - useModuleAccess (the signed-in user's own nav + route guard)
 *
 * Keeping this in one place is what lets the IAM "Manage Permissions"
 * screen and the actual Admin Portal sidebar/route guard agree with each
 * other by construction, instead of drifting the way the old hand-written
 * SC_ALLOWED / FINANCE_ROLE_ALLOWED route lists did.
 */

export interface FunctionPermissionRow {
  function_category: string;
  function_name: string;
  sub_function?: string | null;
  granted: boolean;
}

/** Resolve all (category, functionName) pairs that back a module. */
export function resolveModuleFunctions(mod: AdminModule): Array<{ category: string; functionName: string }> {
  const result: Array<{ category: string; functionName: string }> = [];
  mod.permissions.forEach((p) => {
    const categoryFns = PREDEFINED_FUNCTIONS[p.category as keyof typeof PREDEFINED_FUNCTIONS];
    if (!categoryFns) return;
    if (p.functionName) {
      if (categoryFns[p.functionName]) {
        result.push({ category: p.category, functionName: p.functionName });
      }
    } else {
      Object.keys(categoryFns).forEach((fn) => result.push({ category: p.category, functionName: fn }));
    }
  });
  return result;
}

/**
 * Is `mod` granted for `userRole`, given `rows` (that user's own
 * function_permissions)?
 *
 * - A module with no backing permissions at all (e.g. My Profile) is a
 *   "core" page for any role it lists — nothing to grant/revoke.
 * - A module explicitly marked `core` for this role is that role's
 *   guaranteed home base (e.g. Sales Dashboard for sales_consultant,
 *   Finance & Payments for finance/director) — it doesn't disappear if
 *   every other permission is revoked, so the role always has somewhere
 *   to land.
 * - Everything else requires every backing function to be granted —
 *   matching the "module toggle" unit the admin actually sees and sets
 *   in Manage Permissions.
 */
export function isModuleGranted(
  mod: AdminModule,
  userRole: string | null,
  rows: FunctionPermissionRow[],
): boolean {
  if (mod.permissions.length === 0) return true;
  if (userRole && mod.core?.includes(userRole)) return true;

  const fns = resolveModuleFunctions(mod);
  if (fns.length === 0) return true;

  return fns.every((f) =>
    rows.some(
      (r) =>
        r.function_category === f.category &&
        r.function_name === f.functionName &&
        !r.sub_function &&
        r.granted,
    ),
  );
}

/** Does `pathname` belong to `mod` (its own href, or one of its aliases)? */
export function moduleMatchesPath(mod: AdminModule, pathname: string): boolean {
  const hrefs = [mod.href, ...(mod.aliasPaths ?? [])];
  return hrefs.some((href) => {
    if (pathname === href) return true;
    // '/admin' is the whole portal's root, not a routed page with real
    // sub-routes of its own — treating it as a path *prefix* would make
    // every other admin page match it too (they all start with '/admin/').
    // Every other href either is a specific standalone page or genuinely
    // owns nested routes (e.g. External Portal Management), so prefix
    // matching is safe for those.
    if (href === '/admin') return false;
    return pathname.startsWith(href + '/');
  });
}

/**
 * Find the module (if any) that owns `pathname`. Some modules genuinely
 * nest inside others' paths (e.g. '/admin/external-portal/accounts' sits
 * under '/admin/external-portal'), so among all matches we pick the one
 * with the longest (most specific) href — an exact match on the more
 * specific module wins over a prefix match on its broader parent,
 * regardless of which appears first in the module list.
 */
export function findModuleForPath(modules: AdminModule[], pathname: string): AdminModule | undefined {
  const matches = modules.filter((m) => moduleMatchesPath(m, pathname));
  if (matches.length === 0) return undefined;
  return matches.reduce((best, m) => (m.href.length > best.href.length ? m : best));
}
