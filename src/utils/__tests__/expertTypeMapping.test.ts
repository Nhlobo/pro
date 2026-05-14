import { describe, it, expect } from "vitest";
import {
  normalizeExpertType,
  formatExpertType,
  getUniqueExpertTypes,
  matchesExpertType,
} from "../expertTypeMapping";

describe("expertTypeMapping", () => {
  it("normalises common variations", () => {
    expect(normalizeExpertType("ENT")).toBe("ent_surgeon");
    expect(normalizeExpertType("Orthopaedic Surgeon")).toBe("orthopedic_surgeon");
    expect(normalizeExpertType("Maxillofacial")).toBe("maxillofacial_surgeon");
    expect(normalizeExpertType("GP")).toBe("general_practitioner");
    expect(normalizeExpertType("Anaesthesiologist")).toBe("anesthesiologist");
    expect(normalizeExpertType("Biokineticist")).toBe("biokinetisist");
  });
  it("formats display names from mapping or title case", () => {
    expect(formatExpertType("clinical_psychologist")).toBe("Clinical Psychologist");
    expect(formatExpertType("custom_specialist")).toBe("Custom Specialist");
  });
  it("dedupes and sorts unique types", () => {
    const r = getUniqueExpertTypes([
      { expert_type: "ENT" },
      { expert_type: "ent_surgeon" },
      { expert_type: "GP" },
    ]);
    expect(r.map((x) => x.value).sort()).toEqual(["ent_surgeon", "general_practitioner"]);
    expect(r[0].label.localeCompare(r[1].label)).toBeLessThanOrEqual(0); // alphabetical
  });
  it("matchesExpertType handles 'all' and variations", () => {
    expect(matchesExpertType("ENT", "all")).toBe(true);
    expect(matchesExpertType("Orthopaedic Surgeon", "orthopedic_surgeon")).toBe(true);
    expect(matchesExpertType("GP", "general_practitioner")).toBe(true);
    expect(matchesExpertType("Cardiologist", "Neurologist")).toBe(false);
  });
});
