import { describe, it, expect } from 'vitest';
import {
  AppRole,
  SALES_CONSULTANT_ALLOWED_ADMIN_ROUTES,
  adminRouteRedirect,
  canAccessAdminRoute,
  canAccessAttorneyPortal,
  canAccessExpertPortal,
  getDefaultPortalRoute,
  hasFullAdminAccess,
} from '@/utils/portalAccess';

const ALL_ROLES: AppRole[] = [
  'admin',
  'employee',
  'sales_consultant',
  'medical_expert',
  'referring_attorney',
  'finance',
  'director',
  'user',
  null,
  undefined,
];

const ADMIN_ROUTES = [
  '/admin',
  '/admin/cases',
  '/admin/experts',
  '/admin/reports',
  '/admin/documents',
  '/admin/support',
];

const ADMIN_ONLY_ROUTES = [
  '/admin/analytics',
  '/admin/iam',
  '/admin/system-control',
];

describe('Portal access — admin portal gating', () => {
  it('only admin and employee have unrestricted admin access', () => {
    for (const role of ALL_ROLES) {
      const expected = role === 'admin' || role === 'employee';
      expect(hasFullAdminAccess(role)).toBe(expected);
    }
  });

  it.each([...ADMIN_ROUTES, ...ADMIN_ONLY_ROUTES])(
    'admin can access every admin route (%s)',
    (path) => {
      expect(canAccessAdminRoute('admin', path)).toBe(true);
      expect(adminRouteRedirect('admin', path)).toBeNull();
    },
  );

  it.each(ADMIN_ROUTES)(
    'employee can access shared admin routes (%s)',
    (path) => {
      expect(canAccessAdminRoute('employee', path)).toBe(true);
      expect(adminRouteRedirect('employee', path)).toBeNull();
    },
  );

  it.each(ADMIN_ONLY_ROUTES)(
    'employee is blocked from admin-only route (%s) and redirected to /admin',
    (path) => {
      expect(canAccessAdminRoute('employee', path)).toBe(false);
      expect(adminRouteRedirect('employee', path)).toBe('/admin');
    },
  );

  const NON_ADMIN_ROLES: AppRole[] = [
    'medical_expert',
    'referring_attorney',
    'finance',
    'director',
    'user',
    null,
    undefined,
  ];

  it.each(NON_ADMIN_ROLES)(
    'role %s cannot access the admin portal and is redirected to /dashboard',
    (role) => {
      for (const path of ADMIN_ROUTES) {
        expect(canAccessAdminRoute(role, path)).toBe(false);
        expect(adminRouteRedirect(role, path)).toBe('/dashboard');
      }
    },
  );

  describe('sales_consultant — restricted admin access', () => {
    it.each([...SALES_CONSULTANT_ALLOWED_ADMIN_ROUTES])(
      'is permitted to access %s',
      (path) => {
        expect(canAccessAdminRoute('sales_consultant', path)).toBe(true);
        expect(adminRouteRedirect('sales_consultant', path)).toBeNull();
      },
    );

    it('is permitted to access nested paths under an allowed route', () => {
      expect(
        canAccessAdminRoute('sales_consultant', '/admin/appointments/123'),
      ).toBe(true);
      expect(
        adminRouteRedirect('sales_consultant', '/admin/finance/details'),
      ).toBeNull();
    });

    it.each([
      '/admin',
      '/admin/iam',
      '/admin/system-control',
      '/admin/cases',
      '/admin/experts',
      '/admin/reports',
      '/admin/analytics',
      '/admin/documents',
    ])('is blocked from %s and redirected to /admin/appointments', (path) => {
      expect(canAccessAdminRoute('sales_consultant', path)).toBe(false);
      expect(adminRouteRedirect('sales_consultant', path)).toBe(
        '/admin/appointments',
      );
    });

    it('never escalates: cannot match an allowed prefix that is not a path segment', () => {
      // e.g. /admin/appointments-export must NOT count as /admin/appointments
      expect(
        canAccessAdminRoute('sales_consultant', '/admin/appointments-export'),
      ).toBe(false);
    });
  });
});

describe('Portal access — expert portal gating', () => {
  it('only medical_expert (and admins/employees) can access the expert portal', () => {
    for (const role of ALL_ROLES) {
      const expected =
        role === 'medical_expert' || role === 'admin' || role === 'employee';
      expect(canAccessExpertPortal(role)).toBe(expected);
    }
  });
});

describe('Portal access — attorney portal gating', () => {
  it('only referring_attorney (and admins/employees) can access the attorney portal', () => {
    for (const role of ALL_ROLES) {
      const expected =
        role === 'referring_attorney' || role === 'admin' || role === 'employee';
      expect(canAccessAttorneyPortal(role)).toBe(expected);
    }
  });
});

describe('Portal access — default landing routes', () => {
  it.each([
    ['admin', '/admin'],
    ['employee', '/admin'],
    ['sales_consultant', '/admin/appointments'],
    ['medical_expert', '/expert-portal'],
    ['referring_attorney', '/attorney-portal'],
    ['finance', '/dashboard'],
    ['director', '/dashboard'],
    ['user', '/dashboard'],
  ] as const)('role %s lands on %s', (role, expected) => {
    expect(getDefaultPortalRoute(role)).toBe(expected);
  });

  it('null/undefined roles land on /dashboard', () => {
    expect(getDefaultPortalRoute(null)).toBe('/dashboard');
    expect(getDefaultPortalRoute(undefined)).toBe('/dashboard');
  });
});

describe('Portal access — cross-portal isolation', () => {
  it('medical_expert cannot access attorney portal', () => {
    expect(canAccessAttorneyPortal('medical_expert')).toBe(false);
  });

  it('referring_attorney cannot access expert portal', () => {
    expect(canAccessExpertPortal('referring_attorney')).toBe(false);
  });

  it('sales_consultant cannot access expert or attorney portals', () => {
    expect(canAccessExpertPortal('sales_consultant')).toBe(false);
    expect(canAccessAttorneyPortal('sales_consultant')).toBe(false);
  });

  it('finance/director/user cannot access admin, expert, or attorney portals', () => {
    for (const role of ['finance', 'director', 'user'] as const) {
      expect(hasFullAdminAccess(role)).toBe(false);
      expect(canAccessExpertPortal(role)).toBe(false);
      expect(canAccessAttorneyPortal(role)).toBe(false);
    }
  });
});
