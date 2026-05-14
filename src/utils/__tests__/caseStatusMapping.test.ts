import { describe, it, expect } from "vitest";
import {
  toDbCaseStatus,
  toUiCaseStatus,
  ALLOWED_DB_CASE_STATUSES,
} from "../caseStatusMapping";

describe("caseStatusMapping", () => {
  it("normalises any casing/spacing to the DB whitelist", () => {
    expect(toDbCaseStatus("Scheduled")).toBe("scheduled");
    expect(toDbCaseStatus("ASSESSMENT_COMPLETED")).toBe("assessment_completed");
    expect(toDbCaseStatus("RE-ASSESSED")).toBe("re-assessed");
  });
  it("returns null for unknown / empty input", () => {
    expect(toDbCaseStatus(null)).toBeNull();
    expect(toDbCaseStatus("")).toBeNull();
    expect(toDbCaseStatus("not-a-real-status")).toBeNull();
  });
  it("maps DB → friendly UI label", () => {
    expect(toUiCaseStatus("scheduled")).toBe("Scheduled");
    expect(toUiCaseStatus("report_in_progress")).toBe("Report in Progress");
    expect(toUiCaseStatus(null)).toBe("Scheduled");
    expect(toUiCaseStatus(undefined)).toBe("Scheduled");
  });
  it("falls back to title-case for unknown DB values", () => {
    expect(toUiCaseStatus("foo_bar")).toBe("Foo Bar");
  });
  it("whitelist is non-empty", () => {
    expect(ALLOWED_DB_CASE_STATUSES.length).toBeGreaterThan(5);
  });
});
