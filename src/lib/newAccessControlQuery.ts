import { supabase } from '@/integrations/supabase/client';

export interface NewSystemAccess {
  /** null = no access_role_assignments row at all — authenticated but
   *  not a member of the new internal system (Level 2, per the
   *  approved architecture). Distinct from "a role with zero modules." */
  role: string | null;
  /** This user's staff position (e.g. 'admin_assistant', 'raf_case_manager'),
   *  or null if they have no staff_access_profiles row / it's inactive.
   *  Exposed for UI display; module resolution already accounts for it. */
  positionKey: string | null;
  /** True only for a genuinely unrestricted admin: role_key = 'admin' AND
   *  either no position is on file for them or their position is the
   *  'admin' position itself. This is the ONLY bypass-everything case —
   *  an admin-role user placed in a restricted position (e.g. an "Admin
   *  Assistant") is NOT full access and is resolved through `modules`
   *  like everyone else. Existing admins with no staff_access_profiles
   *  row are completely unaffected by this change. */
  fullAccess: boolean;
  /** module_key -> whether it resolves to granted, after applying
   *  explicit user deny/allow -> explicit position deny/allow -> role
   *  default -> deny. Not meaningful when fullAccess is true. */
  modules: Record<string, boolean>;
}

/**
 * Computes this user's access under the new system. Reads only the new
 * access-control tables (access_role_assignments, role_module_defaults,
 * staff_access_profiles, position_module_overrides, user_module_overrides)
 * — never function_permissions, profiles.role, or the legacy user_roles
 * table. This is intentionally the ONLY place in the frontend that talks
 * to these tables, so the precedence logic lives in exactly one spot.
 *
 * Precedence per module: user_module_overrides (explicit, per person) >
 * position_module_overrides (per staff position) > role_module_defaults
 * (per role) > deny. A module the role isn't eligible for can never be
 * turned on by a position or user override — that safeguard applies at
 * every layer, not just the top one.
 */
export async function fetchNewSystemAccess(userId: string): Promise<NewSystemAccess> {
  // Fail-closed default: no access_role_assignments row is the normal
  // "Level 2 / not a new-system member" case (see the `role: null` doc
  // above), so returning it on error is safe rather than silently wrong —
  // AdminModuleGate treats role === null as "deny, show Access Restricted"
  // rather than granting anything.
  //
  // This whole function used to have no try/catch, and the caller
  // (useModuleAccess) called it as `.then(...)` with no `.catch()` either
  // — so any network hiccup or Supabase error here rejected the promise,
  // the `.then()` callback never ran, `setRowsLoading(false)` was never
  // called, and AdminModuleGate's "Loading access…" spinner spun forever.
  // Fixed 2026-08-31.
  try {
    const { data: assignment, error: assignmentError } = await supabase
      .from('access_role_assignments')
      .select('role_key')
      .eq('user_id', userId)
      .maybeSingle();
    if (assignmentError) throw assignmentError;

    if (!assignment) {
      return { role: null, positionKey: null, fullAccess: false, modules: {} };
    }

    const { data: staffProfile, error: staffProfileError } = await supabase
      .from('staff_access_profiles')
      .select('position_key, is_active')
      .eq('user_id', userId)
      .maybeSingle();
    if (staffProfileError) throw staffProfileError;

    const positionKey = staffProfile?.is_active ? staffProfile.position_key ?? null : null;

    // The ONLY full-access case: role is 'admin' and either no position is on
    // file at all, or the position on file is the unrestricted 'admin'
    // position itself. Any other position under the admin role (e.g.
    // 'admin_assistant') is resolved through the normal module layers below.
    const fullAccess = assignment.role_key === 'admin' && (positionKey === null || positionKey === 'admin');

    if (fullAccess) {
      return { role: assignment.role_key, positionKey, fullAccess: true, modules: {} };
    }

    const [
      { data: defaults, error: defaultsError },
      { data: positionOverrides, error: positionOverridesError },
      { data: userOverrides, error: userOverridesError },
    ] = await Promise.all([
      supabase
        .from('role_module_defaults')
        .select('module_key, is_eligible, is_default_on')
        .eq('role_key', assignment.role_key),
      positionKey
        ? supabase.from('position_module_overrides').select('module_key, granted').eq('position_key', positionKey)
        : Promise.resolve({ data: [] as { module_key: string; granted: boolean }[], error: null }),
      supabase
        .from('user_module_overrides')
        .select('module_key, granted')
        .eq('user_id', userId),
    ]);
    if (defaultsError) throw defaultsError;
    if (positionOverridesError) throw positionOverridesError;
    if (userOverridesError) throw userOverridesError;

    const positionOverrideMap = new Map((positionOverrides ?? []).map((o) => [o.module_key, o.granted as boolean]));
    const userOverrideMap = new Map((userOverrides ?? []).map((o) => [o.module_key, o.granted as boolean]));

    const modules: Record<string, boolean> = {};
    for (const d of defaults ?? []) {
      if (!d.is_eligible) {
        // Not eligible for this role — neither a position override nor a user
        // override can ever turn on a module the role was never meant to see.
        modules[d.module_key] = false;
        continue;
      }
      const userOverride = userOverrideMap.get(d.module_key);
      if (userOverride !== undefined) {
        modules[d.module_key] = userOverride;
        continue;
      }
      const positionOverride = positionOverrideMap.get(d.module_key);
      modules[d.module_key] = positionOverride !== undefined ? positionOverride : d.is_default_on;
    }

    return { role: assignment.role_key, positionKey, fullAccess: false, modules };
  } catch (err) {
    console.error('[fetchNewSystemAccess] failed — failing closed (no access) instead of hanging:', err);
    return { role: null, positionKey: null, fullAccess: false, modules: {} };
  }
}
