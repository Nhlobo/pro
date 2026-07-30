import { describe, it, expect, vi } from "vitest";

// useExpertSearch.tsx talks to Supabase at the hook level; professionMatches
// itself is a pure function, but mock the client anyway (same pattern as
// usePaymentSync.test.ts) so importing the module never risks a real call.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({}),
    functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
  },
}));

import { professionMatches, MEDICO_LEGAL_PROFESSIONS, parseExpertQuery } from "@/hooks/useExpertSearch";

describe("professionMatches", () => {
  it("matches an expert_type against its own profession regardless of case/underscores/spelling", () => {
    expect(professionMatches("orthopedic_surgeon", "Orthopaedic Surgeon")).toBe(true);
    expect(professionMatches("occupational_therapist", "Occupational Therapist")).toBe(true);
    expect(professionMatches("gynecologist", "Gynaecologist")).toBe(true); // US spelling
    expect(professionMatches("pediatrician", "Paediatrician")).toBe(true); // US spelling
    expect(professionMatches("maxillofacial_surgeon", "Maxillofacial Surgeon")).toBe(true);
    expect(professionMatches("nurse", "Nursing Expert")).toBe(true); // legacy DB value
    expect(professionMatches("emergency_medicine", "Emergency Medicine Specialist")).toBe(true);
  });

  it("regression: 'Urologist' must never match an expert filed as 'Neurologist'", () => {
    // Previously matched because "urologist" is a plain substring of
    // "neurologist" — the platform tab of Find Experts could show the wrong
    // specialist entirely. Must stay false.
    expect(professionMatches("neurologist", "Urologist")).toBe(false);
    expect(professionMatches("urologist", "Urologist")).toBe(true);
    expect(professionMatches("urologist", "Neurologist")).toBe(false);
  });

  it("rejects unrelated specialties", () => {
    expect(professionMatches("cardiologist", "Neurologist")).toBe(false);
    expect(professionMatches("dermatologist", "Dentist")).toBe(false);
  });

  it("treats an empty profession filter as 'match everything'", () => {
    expect(professionMatches("anything_at_all", "")).toBe(true);
  });

  it("never cross-matches any two distinct listed professions", () => {
    // Simulates an expert whose expert_type was typed in verbatim as each
    // profession's own label (lowercased, underscored) and checks that no
    // *other* profession's search term matches it.
    const toSnake = (p: string) => p.toLowerCase().replace(/\s+/g, "_");
    for (const profA of MEDICO_LEGAL_PROFESSIONS) {
      for (const profB of MEDICO_LEGAL_PROFESSIONS) {
        if (profA === profB) continue;
        expect(professionMatches(toSnake(profB), profA)).toBe(false);
      }
    }
  });
});

describe("parseExpertQuery (Find Experts quick search box)", () => {
  it("resolves a single-word profession phrased as an 'expert witness' request", () => {
    expect(parseExpertQuery("neurosurgeon expert witness")).toEqual({
      profession: "Neurosurgeon",
      province: "",
      city: "",
    });
  });

  it("resolves a multi-word profession phrased as an 'expert witness' request", () => {
    expect(parseExpertQuery("orthopaedic surgeon expert witness")).toEqual({
      profession: "Orthopaedic Surgeon",
      province: "",
      city: "",
    });
    // American spelling too
    expect(parseExpertQuery("orthopedic surgeon expert witness")).toEqual({
      profession: "Orthopaedic Surgeon",
      province: "",
      city: "",
    });
  });

  it("is case-insensitive and ignores extra punctuation/whitespace", () => {
    expect(parseExpertQuery("  Neurosurgeon   Expert   Witness  ")).toEqual({
      profession: "Neurosurgeon",
      province: "",
      city: "",
    });
  });

  it("also picks up a named province, removing it from the profession match", () => {
    const result = parseExpertQuery("neurosurgeon expert witness in Gauteng");
    expect(result.profession).toBe("Neurosurgeon");
    expect(result.province).toBe("Gauteng");
  });

  it("handles a multi-word province", () => {
    const result = parseExpertQuery("urologist expert witness Western Cape");
    expect(result.profession).toBe("Urologist");
    expect(result.province).toBe("Western Cape");
  });

  it("regression: 'urologist' query must never resolve to Neurologist", () => {
    // Guards the same substring trap professionMatches protects against —
    // "urologist" is literally a substring of "neurologist" — but here in
    // the other direction (parsing free text rather than an expert_type).
    expect(parseExpertQuery("urologist expert witness").profession).toBe("Urologist");
    expect(parseExpertQuery("neurologist expert witness").profession).toBe("Neurologist");
  });

  it("falls back to matching a profession word mixed in with a leftover city", () => {
    const result = parseExpertQuery("find me a neurosurgeon expert witness in Sandton");
    expect(result.profession).toBe("Neurosurgeon");
    expect(result.city).toBe("sandton");
  });

  it("returns an empty profession when nothing recognisable is present", () => {
    expect(parseExpertQuery("expert witness").profession).toBe("");
    expect(parseExpertQuery("").profession).toBe("");
  });
});
