import { describe, it, expect } from "vitest";
import {
  formatInSAST,
  formatDateLong,
  formatDateShort,
  formatDateTimeShort,
  formatTimeSAST,
  todayInSAST,
  sastNowParts,
} from "../dateTime";

describe("dateTime SAST helpers", () => {
  const iso = "2025-01-15T07:00:00Z"; // 09:00 SAST

  it("returns em-dash for nullish", () => {
    expect(formatInSAST(null)).toBe("—");
    expect(formatInSAST(undefined)).toBe("—");
    expect(formatInSAST("")).toBe("—");
  });
  it("returns em-dash for invalid input", () => {
    expect(formatInSAST("not-a-date")).toBe("—");
  });
  it("formats long, short, datetime, time", () => {
    expect(formatDateLong(iso)).toMatch(/15 January 2025/);
    expect(formatDateShort(iso)).toMatch(/15 Jan 2025/);
    expect(formatDateTimeShort(iso)).toMatch(/09:00/);
    expect(formatTimeSAST(iso)).toBe("09:00");
  });
  it("todayInSAST is a yyyy-MM-dd string", () => {
    expect(todayInSAST()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("sastNowParts returns numeric fields", () => {
    const p = sastNowParts();
    expect(typeof p.year).toBe("number");
    expect(p.month).toBeGreaterThanOrEqual(1);
    expect(p.month).toBeLessThanOrEqual(12);
  });
});
