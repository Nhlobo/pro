import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useFunctionPermissions } from '@/hooks/useFunctionPermissions';
import { ADMIN_MODULES, type AdminModule } from '@/config/adminModules';
import { isModuleGranted, findModuleForPath, type FunctionPermissionRow } from '@/lib/moduleAccess';
import { NEW_ACCESS_CONTROL_ENABLED } from '@/config/newAccessControl';
import { fetchNewSystemAccess } from '@/lib/newAccessControlQuery';

/**
 * Whether the current user can see/access a given Admin Portal module —
 * and, by the same logic, a given Admin Portal route.
 *
 * Source of truth: the same `function_permissions` rows and `ADMIN_MODULES`
 * definitions the admin edits in Manage Permissions (Access & IAM ->
 * FunctionPermissionsManager). This hook doesn't introduce a second
 * permission system — it just reads the same grants for "myself" instead
 * of "the user I'm editing," and applies the identical isModuleGranted
 * rule (@/lib/moduleAccess) that the admin UI uses to show a module as
 * enabled.
 *
 * Admin and Company Employee are full-access roles by design (see
 * UserManagement's role picker copy) — they bypass module gating
 * entirely, same as isAdmin()/hasPermission() already treat them.
 */
export const useModuleAccess = () => {
  const { user } = useAuth();
  const { isAdmin, userRole, loading: permsLoading } = usePermissions();
  const { getUserFunctionPermissions } = useFunctionPermissions();
  const [rows, setRows] = useState<FunctionPermissionRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(true);
  // New-system state — only ever populated when the flag is on. When
  // it's off these stay at their initial values and are never read.
  const [newSystemRole, setNewSystemRole] = useState<string | null>(null);
  // Distinct from newSystemRole === 'admin': an admin-role user placed in a
  // restricted staff position (e.g. "Admin Assistant") keeps role 'admin'
  // for audit/IAM purposes but is NOT full access — they're resolved
  // through newSystemModules like everyone else. Only a real, unpositioned
  // (or 'admin'-positioned) admin gets fullAccess = true.
  const [newSystemFullAccess, setNewSystemFullAccess] = useState(false);
  const [newSystemModules, setNewSystemModules] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;

    if (permsLoading) return;

    if (!user) {
      setRows([]);
      setNewSystemRole(null);
      setNewSystemFullAccess(false);
      setNewSystemModules({});
      setRowsLoading(false);
      return;
    }

    if (NEW_ACCESS_CONTROL_ENABLED) {
      setRowsLoading(true);
      fetchNewSystemAccess(user.id)
        .then(({ role, fullAccess, modules }) => {
          if (active) {
            setNewSystemRole(role);
            setNewSystemFullAccess(fullAccess);
            setNewSystemModules(modules);
            setRowsLoading(false);
          }
        })
        .catch((err) => {
          // Belt-and-suspenders: fetchNewSystemAccess already fails closed
          // internally and shouldn't reject, but if it somehow does, still
          // resolve loading instead of leaving "Loading access…" spinning
          // forever (see GlobalErrorBoundary for the same philosophy applied
          // to render errors).
          console.error('[useModuleAccess] fetchNewSystemAccess rejected:', err);
          if (active) {
            setNewSystemRole(null);
            setNewSystemFullAccess(false);
            setNewSystemModules({});
            setRowsLoading(false);
          }
        });
      return () => {
        active = false;
      };
    }

    // --- Everything below this line is the original, unmodified
    // legacy path — byte-for-byte what ran before this file existed,
    // untouched so the flag-off behavior is guaranteed identical. ---
    if (isAdmin()) {
      // Full-access roles never need the per-module grant list.
      setRows([]);
      setRowsLoading(false);
      return;
    }

    setRowsLoading(true);
    getUserFunctionPermissions(user.id)
      .then((list) => {
        if (active) {
          setRows(list as FunctionPermissionRow[]);
          setRowsLoading(false);
        }
      })
      .catch((err) => {
        console.error('[useModuleAccess] getUserFunctionPermissions rejected:', err);
        if (active) {
          setRows([]);
          setRowsLoading(false);
        }
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, userRole, permsLoading]);

  const canAccessModule = (mod: AdminModule): boolean => {
    // A module marked hideFromAdmin (a narrower, role-scoped duplicate of
    // an admin-only module) opts out of the full-access bypass below in
    // both branches. NOTE: this must check the literal 'admin' role, not
    // isAdmin() — isAdmin() is true for BOTH 'admin' and 'employee'
    // (see usePermissions: "Check if user is admin or employee (both have
    // full system access)"), so using it here would hide the module from
    // employees too, not just admins.
    if (mod.hideFromAdmin && userRole === 'admin') return false;

    if (NEW_ACCESS_CONTROL_ENABLED) {
      if (newSystemFullAccess) return true;
      if (newSystemRole === null) return false; // not a new-system member (Level 2)
      return newSystemModules[mod.key] === true;
    }
    // Legacy path, unchanged.
    if (isAdmin()) return true;
    if (!mod.roles || !mod.roles.includes(userRole || '')) return false;
    return isModuleGranted(mod, userRole, rows);
  };

  const canAccessPath = (pathname: string): boolean => {
    // Same literal-'admin' distinction as canAccessModule above — filter
    // by role string, not isAdmin(), or employees get excluded from this
    // route-resolution step too.
    const candidateModules = userRole === 'admin' ? ADMIN_MODULES.filter((m) => !m.hideFromAdmin) : ADMIN_MODULES;
    const mod = findModuleForPath(candidateModules, pathname);
    // A path with no matching module (nothing in ADMIN_MODULES claims it)
    // is treated as admin-only.
    if (!mod) return NEW_ACCESS_CONTROL_ENABLED ? newSystemFullAccess : isAdmin();
    return canAccessModule(mod);
  };

  const accessibleModules = ADMIN_MODULES.filter(canAccessModule);

  /** This role's guaranteed landing page. New system: its first
   *  default-on module, per role_module_defaults. Legacy: its `core`
   *  module if it has one, else Operations Dashboard for admin/
   *  employee, else the first module it can actually reach, else My
   *  Profile as a last resort. */
  const homeModule: AdminModule | undefined = NEW_ACCESS_CONTROL_ENABLED
    ? newSystemFullAccess
      ? ADMIN_MODULES.find((m) => m.key === 'operations')
      : ADMIN_MODULES.find((m) => newSystemModules[m.key]) ?? accessibleModules[0]
    : isAdmin()
      ? ADMIN_MODULES.find((m) => m.key === 'operations')
      : ADMIN_MODULES.find((m) => m.core?.includes(userRole || '')) ?? accessibleModules[0];
  const homeHref = homeModule?.href ?? '/admin/my-profile';

  return {
    loading: permsLoading || rowsLoading,
    canAccessModule,
    canAccessPath,
    accessibleModules,
    homeModule,
    homeHref,
  };
};

export default useModuleAccess;
