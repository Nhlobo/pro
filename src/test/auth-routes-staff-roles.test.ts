import { describe, it, expect } from 'vitest';
import { PORTAL_ROLES, isValidPortalRole, getDashboardPathForRole } from '@/utils/authRoutes';

// Regression coverage for the 2026-08-30 incident:
//   - worksof26@gmail.com (Finance), worksof28@gmail.com (Director), and
//     info@kutlwanoassociate.com (Admin) were all silently bridged into
//     External Portal identities via supabase/functions/external-portal-auth,
//     which mis-routed their internal staff logins to /attorney-portal.
//   - Fixing that surfaced a second, independent bug: PORTAL_ROLES was
//     missing 'finance' and 'director' entirely, so those two staff roles
//     failed isValidPortalRole() and were signed straight back out with
//     "Access not authorized" -- see src/pages/Auth.tsx's finishSignIn.
//
// The full internal-staff role set is also asserted against
// create-user/index.ts's validRoles list below (kept as a literal copy,
// since that file is a Deno edge function and can't be imported into a
// Vitest/Node test) so a future new staff role can't silently reintroduce
// either failure mode.
const INTERNAL_STAFF_ROLES = ['admin', 'employee', 'sales_consultant', 'finance', 'director'];
const EXTERNAL_PORTAL_ROLES = ['referring_attorney', 'medical_expert'];

describe('PORTAL_ROLES completeness', () => {
  it('accepts every internal staff role create-user can provision', () => {
    for (const role of INTERNAL_STAFF_ROLES) {
      expect(isValidPortalRole(role)).toBe(true);
    }
  });

  it('accepts both external-portal roles', () => {
    for (const role of EXTERNAL_PORTAL_ROLES) {
      expect(isValidPortalRole(role)).toBe(true);
    }
  });

  it('rejects unknown/empty roles', () => {
    expect(isValidPortalRole('user')).toBe(false);
    expect(isValidPortalRole(null)).toBe(false);
    expect(isValidPortalRole(undefined)).toBe(false);
    expect(isValidPortalRole('')).toBe(false);
  });

  it('has no duplicate or unexpected entries', () => {
    const expected = [...INTERNAL_STAFF_ROLES, ...EXTERNAL_PORTAL_ROLES].sort();
    expect([...PORTAL_ROLES].sort()).toEqual(expected);
  });
});

describe('getDashboardPathForRole staff-vs-external routing', () => {
  it('sends every internal staff role to the internal dashboard, never the external portal', () => {
    for (const role of INTERNAL_STAFF_ROLES) {
      const path = getDashboardPathForRole(role);
      expect(path).toBe('/dashboard');
      expect(path).not.toMatch(/portal/);
    }
  });

  it('sends referring_attorney to the attorney portal', () => {
    expect(getDashboardPathForRole('referring_attorney')).toBe('/attorney-portal');
  });

  it('sends medical_expert to the expert portal', () => {
    expect(getDashboardPathForRole('medical_expert')).toBe('/expert-portal');
  });

  it('never sends a staff role to an external portal even if userType is also set', () => {
    // Mirrors the exact contamination pattern found in production: a
    // profile whose `role` is a genuine staff role but whose `user_type`
    // was overwritten to 'external_portal' by the bridge. `role` must win.
    for (const role of INTERNAL_STAFF_ROLES) {
      expect(getDashboardPathForRole(role, 'external_portal')).toBe('/dashboard');
    }
  });
});
