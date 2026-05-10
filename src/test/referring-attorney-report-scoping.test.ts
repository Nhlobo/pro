import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Test checklist — Referring Attorney Report scoping
 *
 * Verifies that the report page:
 *  1. Only scopes to a single firm when the logged-in user is a
 *     `referring_attorney` role (so Mavuya and other firms are visible
 *     to admin / staff / managers).
 *  2. Always honours the firm dropdown when an admin picks one.
 *  3. Does NOT hard-filter by `referring_attorney_id` for non-attorney roles.
 *  4. Re-fetches when the attorney/period filters change.
 *  5. Supports an "All Time" report type so firms without current-period
 *     appointments (e.g. Mavuya) still surface their claimant reports.
 */

const source = readFileSync(
  resolve(__dirname, "../pages/ReferringAttorneyReport.tsx"),
  "utf8",
);

describe("ReferringAttorneyReport — admin vs attorney scoping", () => {
  it("derives an isAttorneyUser flag from the profile role", () => {
    expect(source).toMatch(/isAttorneyUser\s*=\s*profile\?\.role\s*===\s*['"]referring_attorney['"]/);
  });

  it("only filters appointments by referring_attorney_id when the user is a referring attorney", () => {
    // The hard `.eq('referring_attorney_id', ...)` must be guarded by isAttorneyUser
    const guardedFilters = source.match(
      /if\s*\(\s*isAttorneyUser\s*\)\s*\{[\s\S]*?\.eq\(\s*['"]referring_attorney_id['"]/g,
    );
    expect(guardedFilters && guardedFilters.length).toBeGreaterThanOrEqual(2);
  });

  it("never applies an unconditional referring_attorney_id filter", () => {
    // Reject any `.eq('referring_attorney_id', ...)` that is not preceded
    // (within a few lines) by an `isAttorneyUser` guard.
    const occurrences = [...source.matchAll(/\.eq\(\s*['"]referring_attorney_id['"]/g)];
    for (const match of occurrences) {
      const start = Math.max(0, (match.index ?? 0) - 200);
      const window = source.slice(start, match.index);
      expect(window).toMatch(/isAttorneyUser/);
    }
  });

  it("honours the dropdown selection so admins can pick Mavuya or any other firm", () => {
    expect(source).toMatch(
      /effectiveSelectedAttorney\s*!==\s*['"]all['"][\s\S]{0,200}\.eq\(\s*['"]referring_attorney['"]/,
    );
  });

  it("only forces the dropdown to the user's own firm for referring_attorney role", () => {
    // The block that overrides `effectiveSelectedAttorney` must be inside an
    // isAttorneyUser branch.
    const overrideMatches = [
      ...source.matchAll(/effectiveSelectedAttorney\s*=\s*attorneyName/g),
    ];
    expect(overrideMatches.length).toBeGreaterThan(0);
    for (const match of overrideMatches) {
      const start = Math.max(0, (match.index ?? 0) - 200);
      expect(source.slice(start, match.index)).toMatch(/isAttorneyUser/);
    }
  });

  it("re-fetches data when filters change (deps include attorney + period)", () => {
    expect(source).toMatch(
      /\}\,\s*\[selectedAttorney,\s*selectedMonth,\s*selectedYear,\s*reportType\]/,
    );
  });

  it("supports an 'All Time' report type so firms with older-only data still appear", () => {
    expect(source).toMatch(/reportType[\s\S]{0,80}'all'/);
    expect(source).toMatch(/SelectItem\s+value="all">All Time<\/SelectItem>/);
  });

  it("skips the date filter when reportType is 'all'", () => {
    expect(source).toMatch(/if\s*\(!startDate\s*\|\|\s*!endDate\)\s*return\s+true/);
  });
});
