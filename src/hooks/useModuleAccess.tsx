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
  const [newSystemModules, setNewSystemModules] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;

    if (permsLoading) return;

    if (!user) {
      setRows([]);
      setNewSystemRole(null);
      setNewSystemModules({});
      setRowsLoading(false);
      return;
    }

    if (NEW_ACCESS_CONTROL_ENABLED) {
      setRowsLoading(true);
      fetchNewSystemAccess(user.id).then(({ role, modules }) => {
        if (active) {
          setNewSystemRole(role);
          setNewSystemModules(modules);
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
    getUserFunctionPermissions(user.id).then((list) => {
      if (active) {
        setRows(list as FunctionPermissionRow[]);
        setRowsLoading(false);
      }
    });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, userRole, permsLoading]);

  const canAccessModule = (mod: AdminModule): boolean => {
    if (NEW_ACCESS_CONTROL_ENABLED) {
      if (newSystemRole === 'admin') return true;
      if (newSystemRole === null) return false; // not a new-system member (Level 2)
      return newSystemModules[mod.key] === true;
    }
    // Legacy path, unchanged.
    if (isAdmin()) return true;
    if (!mod.roles || !mod.roles.includes(userRole || '')) return false;
    return isModuleGranted(mod, userRole, rows);
  };

  const canAccessPath = (pathname: string): boolean => {
    const mod = findModuleForPath(ADMIN_MODULES, pathname);
    // A path with no matching module (nothing in ADMIN_MODULES claims it)
    // is treated as admin-only.
    if (!mod) return NEW_ACCESS_CONTROL_ENABLED ? newSystemRole === 'admin' : isAdmin();
    return canAccessModule(mod);
  };

  const accessibleModules = ADMIN_MODULES.filter(canAccessModule);

  /** This role's guaranteed landing page. New system: its first
   *  default-on module, per role_module_defaults. Legacy: its `core`
   *  module if it has one, else Operations Dashboard for admin/
   *  employee, else the first module it can actually reach, else My
   *  Profile as a last resort. */
  const homeModule: AdminModule | undefined = NEW_ACCESS_CONTROL_ENABLED
    ? newSystemRole === 'admin'
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
