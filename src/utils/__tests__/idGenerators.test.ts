import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  generateClaimantId,
  generateLawFirmCodeBase,
  generateLawFirmCode,
  generateExpertCode,
  generateAppointmentRequestId,
  generateAssessmentCode,
  getAssessmentTypeAbbreviation,
} from "../idGenerators";

describe("idGenerators", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-03-15T10:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  describe("generateClaimantId", () => {
    it("uses uppercase initials and 4-digit random suffix", () => {
      const id = generateClaimantId("john", "doe");
      expect(id).toMatch(/^JD\d{4}$/);
    });
    it("falls back to X for empty names", () => {
      expect(generateClaimantId("", "")).toMatch(/^XX\d{4}$/);
    });
  });

  describe("generateLawFirmCodeBase / generateLawFirmCode", () => {
    it("encodes initials + YY + MM", () => {
      expect(generateLawFirmCodeBase("Steve Thompson", "X")).toBe("ST2503");
    });
    it("appends a 2-digit sequence", () => {
      expect(generateLawFirmCode("Steve Thompson", "X", 7)).toBe("ST250307");
    });
    it("replaces non-letter initials with X", () => {
      expect(generateLawFirmCodeBase("123 456", "X")).toBe("XX2503");
    });
  });

  describe("generateExpertCode", () => {
    it("produces NS + 5-digit number", () => {
      expect(generateExpertCode("Jane", "Smith")).toMatch(/^JS\d{5}$/);
    });
  });

  describe("generateAppointmentRequestId", () => {
    it("uses YYYYMM", () => {
      expect(generateAppointmentRequestId("Bob", "Lee")).toBe("BL202503");
    });
  });

  describe("generateAssessmentCode", () => {
    it("maps known assessment types to abbreviations", () => {
      expect(generateAssessmentCode("MVA", "2025-06-08", "John", "Doe"))
        .toBe("RAF-2025-06-JD");
      expect(generateAssessmentCode("Medical Negligence", "2025-06-08"))
        .toBe("Med-Neg-2025-06");
    });
    it("falls back to first 3 chars uppercase for unknown types", () => {
      expect(generateAssessmentCode("Custom Type", "2025-06-08")).toMatch(/^CUS-2025-06/);
    });
    it("uses today when appointmentDate is empty or invalid", () => {
      expect(generateAssessmentCode("MVA", "")).toBe("RAF-2025-03");
      expect(generateAssessmentCode("MVA", "not-a-date")).toBe("RAF-2025-03");
    });
  });

  describe("getAssessmentTypeAbbreviation", () => {
    it("returns mapping or 3-char fallback", () => {
      expect(getAssessmentTypeAbbreviation("Joint Minutes")).toBe("JM");
      expect(getAssessmentTypeAbbreviation("Foobar")).toBe("FOO");
    });
  });
});
