import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * End-to-end (source-level) test verifying that creating a new expert from
 * `/admin/experts` persists the record and surfaces it in the experts list
 * afterward.
 *
 * The flow under test:
 *   1. User opens /admin/experts and switches to the "New Expert" tab.
 *   2. MedicalExpertFormPage inserts into `medical_experts` on submit.
 *   3. On success it calls onSaved() and dispatches `medical-expert-updated`.
 *   4. AdminExpertNetwork listens for that event and refetches via
 *      `get_medical_experts_secure`, so the newly created expert appears
 *      in the directory table without a manual reload.
 */

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf-8");

describe("Admin experts: create + list refresh", () => {
  const adminPage = read("src/pages/admin/AdminExpertNetwork.tsx");
  const formModule = read("src/components/admin/ExpertFormModule.tsx");
  const formPage = read("src/pages/MedicalExpertFormPage.tsx");

  it("exposes a New Expert tab that renders the form without an editExpertId", () => {
    expect(adminPage).toMatch(/value="new-expert"/);
    expect(adminPage).toMatch(
      /<TabsContent value="new-expert"[\s\S]*?<ExpertFormModule\s*\/>/,
    );
  });

  it("ExpertFormModule forwards onSaved to MedicalExpertFormPage", () => {
    expect(formModule).toMatch(/onSaved\?:\s*\(\)\s*=>\s*void/);
    expect(formModule).toMatch(
      /<MedicalExpertFormPage[\s\S]*onSaved=\{onSaved\}/,
    );
  });

  it("MedicalExpertFormPage inserts a new row into medical_experts on create", () => {
    // Create branch (not edit) performs .from('medical_experts').insert(...)
    expect(formPage).toMatch(
      /\.from\(['"]medical_experts['"]\)\s*\n\s*\.insert\(expertData\)/,
    );
    // And selects the inserted row so the saved id is available downstream
    expect(formPage).toMatch(/\.insert\(expertData\)\s*\n\s*\.select\(\)/);
  });

  it("dispatches a `medical-expert-updated` event after save so lists refresh", () => {
    expect(formPage).toMatch(/medical-expert-updated/);
  });

  it("AdminExpertNetwork refetches the directory on `medical-expert-updated`", () => {
    expect(adminPage).toMatch(/get_medical_experts_secure/);
    expect(adminPage).toMatch(
      /addEventListener\(\s*['"]medical-expert-updated['"]/,
    );
    // Handler invokes refetchExperts which calls the secure RPC
    expect(adminPage).toMatch(/refetchExperts\s*=\s*async/);
    expect(adminPage).toMatch(
      /refetchExperts[\s\S]{0,200}rpc\(['"]get_medical_experts_secure['"]\)/,
    );
  });

  it("onSaved from the edit tab also refreshes the experts list", () => {
    // The onSaved callback wired in AdminExpertNetwork re-runs the same RPC
    expect(adminPage).toMatch(
      /onSaved=\{[\s\S]*?rpc\(['"]get_medical_experts_secure['"]\)/,
    );
  });

  it("useSecureMedicalExperts also listens for the update event (directory hook)", () => {
    const hook = read("src/hooks/useSecureMedicalExperts.tsx");
    expect(hook).toMatch(
      /addEventListener\(\s*['"]medical-expert-updated['"]/,
    );
    expect(hook).toMatch(/get_medical_experts_secure/);
  });
});
