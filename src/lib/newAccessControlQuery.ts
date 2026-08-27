import { supabase } from '@/integrations/supabase/client';

export interface NewSystemAccess {
  /** null = no access_role_assignments row at all — authenticated but
   *  not a member of the new internal system (Level 2, per the
   *  approved architecture). Distinct from "a role with zero modules." */
  role: string | null;
  /** module_key -> whether it resolves to granted, after applying
   *  explicit deny -> explicit allow -> role default -> deny. */
  modules: Record<string, boolean>;
}

/**
 * Computes this user's access under the new system. Reads only the six
 * new tables (access_role_assignments, role_module_defaults,
 * user_module_overrides) — never function_permissions, profiles.role,
 * or user_roles. This is intentionally the ONLY place in the frontend
 * that talks to the new tables, so the precedence logic (explicit deny
 * -> explicit allow -> role default -> deny) lives in exactly one spot.
 */
export async function fetchNewSystemAccess(userId: string): Promise<NewSystemAccess> {
  const { data: assignment } = await supabase
    .from('access_role_assignments')
    .select('role_key')
    .eq('user_id', userId)
    .maybeSingle();

  if (!assignment) {
    return { role: null, modules: {} };
  }

  const [{ data: defaults }, { data: overrides }] = await Promise.all([
    supabase
      .from('role_module_defaults')
      .select('module_key, is_eligible, is_default_on')
      .eq('role_key', assignment.role_key),
    supabase
      .from('user_module_overrides')
      .select('module_key, granted')
      .eq('user_id', userId),
  ]);

  const overrideMap = new Map(
    (overrides ?? []).map((o) => [o.module_key, o.granted as boolean])
  );

  const modules: Record<string, boolean> = {};
  for (const d of defaults ?? []) {
    if (!d.is_eligible) {
      // Not eligible for this role — an override can never turn on an
      // ineligible module (the safeguard agreed several rounds ago:
      // an override can only adjust something eligible, never make an
      // admin-only module reachable for a role that was never meant
      // to see it at all).
      modules[d.module_key] = false;
      continue;
    }
    const override = overrideMap.get(d.module_key);
    modules[d.module_key] = override !== undefined ? override : d.is_default_on;
  }

  return { role: assignment.role_key, modules };
}
