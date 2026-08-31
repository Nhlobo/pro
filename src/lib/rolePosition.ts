import { supabase } from '@/integrations/supabase/client';

/**
 * Single source of truth for the internal staff role system.
 *
 * "Referring Attorney" and "Medical Expert" are intentionally excluded --
 * those are External Portal identities (external_portal_accounts / the
 * external_portal role values on profiles), not internal staff roles, and
 * must never be offered anywhere a System Role is being assigned to
 * internal staff (Add User, Manage Access, Edit Full Profile).
 *
 * Both UserManagement.tsx (Access & Permissions) and EditProfileDialog.tsx
 * (Edit Full Profile) import this instead of keeping their own copies, so
 * the role list and its labels can't drift apart between screens.
 */
export const INTERNAL_ROLES = ['admin', 'employee', 'sales_consultant', 'finance', 'director'] as const;
export type InternalRole = (typeof INTERNAL_ROLES)[number];

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  employee: 'Company Employee',
  sales_consultant: 'Sales Consultant',
  finance: 'Finance',
  director: 'Director',
  // Not internal roles, but a handful of legacy/external rows can still
  // carry these values -- label them honestly rather than falling back
  // to a generic "User" if one ever shows up in an internal-staff view.
  referring_attorney: 'Referring Attorney (External Portal)',
  medical_expert: 'Medical Expert (External Portal)',
};

export function roleLabel(role: string | null | undefined): string {
  if (!role) return 'No role assigned';
  return ROLE_LABELS[role] ?? `Unrecognized role (${role})`;
}

export function isInternalRole(role: string | null | undefined): role is InternalRole {
  return !!role && (INTERNAL_ROLES as readonly string[]).includes(role);
}

export interface StaffPositionRow {
  position_key: string;
  role_key: string;
  display_name: string;
}

/**
 * Fetches the active staff_positions table -- the DB-level source of truth
 * for which staff positions exist and which System Role each one belongs
 * to (role_position_rules mirrors this same role_key/position_key pairing).
 * A position is valid for a role if and only if it appears here with a
 * matching role_key; nothing in the UI should hardcode its own list.
 */
export async function fetchStaffPositions(): Promise<StaffPositionRow[]> {
  const { data, error } = await supabase
    .from('staff_positions')
    .select('position_key, role_key, display_name')
    .eq('is_active', true)
    .order('display_name');
  if (error) {
    console.error('Error fetching staff_positions:', error);
    return [];
  }
  return data ?? [];
}

/** Positions allowed for a given System Role, per the shared source of truth. */
export function positionsForRole(positions: StaffPositionRow[], role: string | null | undefined): StaffPositionRow[] {
  if (!role) return [];
  return positions.filter((p) => p.role_key === role);
}

/**
 * When a role has exactly one valid position, that position is the
 * unambiguous default -- e.g. Sales Consultant, Finance, Director. When a
 * role has zero (unrecognized role) or more than one (Admin: Admin /
 * Admin Assistant; Employee: NEG / RAF Case Manager) valid positions,
 * there is no single correct default and the picker must ask instead of
 * guessing.
 */
export function defaultPositionForRole(positions: StaffPositionRow[], role: string | null | undefined): StaffPositionRow | null {
  const valid = positionsForRole(positions, role);
  return valid.length === 1 ? valid[0] : null;
}
