import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Test checklist — Admin Reporting Dashboard scheduled assessment source
 *
 * Verifies that the /admin/reporting report uses scheduled assessment
 * appointment rows as the source of claimant/attorney report data, including
 * firms such as Mavuya Attorneys whose stored names include extra whitespace.
 */

const source = readFileSync(
  resolve(__dirname, "../pages/admin/AdminReportingDashboard.tsx"),
  "utf8",
);

describe("AdminReportingDashboard — scheduled assessment report source", () => {
  it("fetches rows from appointments using appointment_date as the scheduled assessment date", () => {
    expect(source).toMatch(/\.from\(['"]appointments['"]\)/);
    expect(source).toMatch(/scheduledAssessmentDate\s*=\s*a\.appointment_date/);
    expect(source).toMatch(/appointment_date:\s*scheduledAssessmentDate/);
  });

  it("filters 2025/current periods against appointment_date, not report dates", () => {
    expect(source).toMatch(/\.gte\(['"]appointment_date['"],\s*start\.toISOString\(\)\)/);
    expect(source).toMatch(/\.lt\(['"]appointment_date['"],\s*end\.toISOString\(\)\)/);
    expect(source).not.toMatch(/\.gte\(['"]report_submitted_date['"],\s*start\.toISOString\(\)\)/);
  });

  it("normalises referring attorney names so Mavuya Attorneys with stored trailing spaces matches the dropdown", () => {
    expect(source).toMatch(/const\s+normalizeAttorneyName\s*=/);
    expect(source).toMatch(/replace\(\/\\s\+\/g, ['"] ['"]\)\.trim\(\)/);
    expect(source).toMatch(/referring_attorney:\s*normalizeAttorneyName\(a\.referring_attorney\)/);
    expect(source).toMatch(/normalizeAttorneyName\(r\.referring_attorney\)\s*===\s*selectedAttorneyName/);
  });

  it("keeps active attorneys counted from scheduled appointments since 1 Jan 2025", () => {
    expect(source).toMatch(/new Date\(['"]2025-01-01['"]\)\.toISOString\(\)/);
    expect(source).toMatch(/counts\.set\(name, \(counts\.get\(name\) \|\| 0\) \+ 1\)/);
  });
});
