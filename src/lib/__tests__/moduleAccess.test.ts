import { describe, it, expect } from 'vitest';
import { isModuleGranted, moduleMatchesPath, findModuleForPath, resolveModuleFunctions } from '@/lib/moduleAccess';
import { ADMIN_MODULES } from '@/config/adminModules';
import type { AdminModule } from '@/config/adminModules';

const mod = (overrides: Partial<AdminModule>): AdminModule => ({
  key: 'test',
  title: 'Test Module',
  href: '/admin/test',
  group: 'Workflow',
  icon: (() => null) as any,
  description: 'test',
  permissions: [],
  ...overrides,
});

describe('isModuleGranted', () => {
  it('grants a module with no backing permissions unconditionally (core page)', () => {
    const m = mod({ permissions: [] });
    expect(isModuleGranted(m, 'sales_consultant', [])).toBe(true);
  });

  it('denies a permission-backed module when nothing is granted', () => {
    const m = mod({ permissions: [{ category: 'Appointment Management' }] });
    expect(isModuleGranted(m, 'sales_consultant', [])).toBe(false);
  });

  it('grants a permission-backed module once every backing function is granted', () => {
    const m = mod({ permissions: [{ category: 'Appointment Management' }] });
    const fns = resolveModuleFunctions(m);
    const rows = fns.map((f) => ({
      function_category: f.category,
      function_name: f.functionName,
      sub_function: null,
      granted: true,
    }));
    expect(isModuleGranted(m, 'sales_consultant', rows)).toBe(true);
  });

  it('denies when only some backing functions are granted (partial grant)', () => {
    const m = mod({ permissions: [{ category: 'Appointment Management' }] });
    const fns = resolveModuleFunctions(m);
    const rows = [
      { function_category: fns[0].category, function_name: fns[0].functionName, sub_function: null, granted: true },
    ];
    expect(isModuleGranted(m, 'sales_consultant', rows)).toBe(false);
  });

  it('revoking a previously-granted function removes access', () => {
    const m = mod({ permissions: [{ category: 'Appointment Management' }] });
    const fns = resolveModuleFunctions(m);
    const granted = fns.map((f) => ({
      function_category: f.category,
      function_name: f.functionName,
      sub_function: null,
      granted: true,
    }));
    expect(isModuleGranted(m, 'sales_consultant', granted)).toBe(true);

    const revoked = granted.map((r, i) => (i === 0 ? { ...r, granted: false } : r));
    expect(isModuleGranted(m, 'sales_consultant', revoked)).toBe(false);
  });

  it('a role-specific core module is granted even with zero permission rows', () => {
    const m = mod({ permissions: [{ category: 'Analytics & Reporting' }], core: ['sales_consultant'] });
    expect(isModuleGranted(m, 'sales_consultant', [])).toBe(true);
  });

  it('the core carve-out only applies to the listed role, not others', () => {
    const m = mod({ permissions: [{ category: 'Analytics & Reporting' }], core: ['sales_consultant'] });
    expect(isModuleGranted(m, 'finance', [])).toBe(false);
  });
});

describe('moduleMatchesPath / findModuleForPath', () => {
  it('matches the module href exactly and as a prefix', () => {
    const m = mod({ href: '/admin/test' });
    expect(moduleMatchesPath(m, '/admin/test')).toBe(true);
    expect(moduleMatchesPath(m, '/admin/test/123')).toBe(true);
    expect(moduleMatchesPath(m, '/admin/testing')).toBe(false);
  });

  it('matches aliasPaths too', () => {
    const m = mod({ href: '/admin/external-portal/accounts', aliasPaths: ['/admin/external-portal/links'] });
    expect(moduleMatchesPath(m, '/admin/external-portal/links')).toBe(true);
  });

  it('findModuleForPath finds the owning module from the real ADMIN_MODULES list', () => {
    const accounts = findModuleForPath(ADMIN_MODULES, '/admin/external-portal/accounts');
    const links = findModuleForPath(ADMIN_MODULES, '/admin/external-portal/links');
    expect(accounts?.key).toBe('external-portal-access');
    expect(links?.key).toBe('external-portal-access');
  });

  it('returns undefined for a path no module owns', () => {
    expect(findModuleForPath(ADMIN_MODULES, '/admin/does-not-exist')).toBeUndefined();
  });
});

describe('real ADMIN_MODULES sanity checks', () => {
  it('sales-dashboard and finance are the only core modules, for the expected roles', () => {
    const core = ADMIN_MODULES.filter((m) => m.core && m.core.length > 0);
    const byKey = Object.fromEntries(core.map((m) => [m.key, m.core]));
    expect(byKey['sales-dashboard']).toEqual(['sales_consultant']);
    expect(byKey['finance']).toEqual(['finance', 'director']);
  });

  it('finance and director are eligible for both finance and expert-payment-planner', () => {
    const finance = ADMIN_MODULES.find((m) => m.key === 'finance')!;
    const planner = ADMIN_MODULES.find((m) => m.key === 'expert-payment-planner')!;
    expect(finance.roles).toContain('finance');
    expect(finance.roles).toContain('director');
    expect(planner.roles).toContain('finance');
    expect(planner.roles).toContain('director');
  });
});
