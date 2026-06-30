import { describe, it, expect } from "vitest";
import { getClaimPhraseForMatterType } from "../matterTypeClaimPhrase";

describe("getClaimPhraseForMatterType", () => {
  const cases: Array<[string | null | undefined, string]> = [
    [null, "a Road Accident Fund claim"],
    ["", "a Road Accident Fund claim"],
    ["Medical Negligence", "a Medical Negligence claim"],
    ["Affidavits", "an Affidavit in support of the claim"],
    ["Addendum", "an Addendum to the previously issued medico-legal report"],
    ["Joint Minutes", "Joint Minutes following the medico-legal assessment"],
    ["Merit Report", "a Merit Report on the claim"],
    ["Assault Matter", "an Assault Matter claim"],
    ["Slip and Fall Matter", "a Slip and Fall Matter claim"],
    ["Court Preparation", "Court Preparation in respect of the claim"],
    ["Court Attendance", "Court Attendance in respect of the claim"],
    ["Mitigation", "Mitigation in respect of the claim"],
    ["MVA", "a Road Accident Fund claim"],
    ["RAF", "a Road Accident Fund claim"],
  ];
  for (const [input, expected] of cases) {
    it(`maps ${JSON.stringify(input)} → ${expected}`, () => {
      expect(getClaimPhraseForMatterType(input)).toBe(expected);
    });
  }
  it("falls back to a generic phrase for unknown types", () => {
    expect(getClaimPhraseForMatterType("Bespoke Claim")).toBe("a Bespoke Claim matter");
  });
});
