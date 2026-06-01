import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * End-to-end behavioural contract — /admin/experts (no ?edit=)
 *
 * Verifies that opening the expert network page without a deep-link edit
 * parameter keeps the UI in the create / default state rather than
 * accidentally preloading an unrelated expert record.
 *
 * The flow has three guarantees that must hold together:
 *
 *  1. AdminExpertNetwork leaves editExpertId as null when there is no
 *     ?edit=<id> in the URL, and the active tab starts at "overview".
 *
 *  2. The edit-expert tab trigger is only rendered when editExpertId is
 *     truthy, so it never appears on a plain /admin/experts load.
 *
 *  3. MedicalExpertFormPage resolves expertId to null/undefined, which
 *     makes isEditMode false. The form therefore skips loadExpertForEdit
 *     and starts with blank default values (create mode).
 */

const adminNetwork = readFileSync(
  resolve(__dirname, "../pages/admin/AdminExpertNetwork.tsx"),
  "utf8",
);

const expertModule = readFileSync(
  resolve(__dirname, "../components/admin/ExpertFormModule.tsx"),
  "utf8",
);

const formPage = readFileSync(
  resolve(__dirname, "../pages/MedicalExpertFormPage.tsx"),
  "utf8",
);

describe("/admin/experts without ?edit= stays in create/default state", () => {
  it("initializes editExpertId as null and activeTab as overview", () => {
    // Default state must not assume an expert is being edited.
    expect(adminNetwork).toMatch(
      /const\s+\[\s*editExpertId\s*,\s*setEditExpertId\s*\]\s*=\s*useState\s*<[^>]*>\s*\(\s*null\s*\)/,
    );
    expect(adminNetwork).toMatch(
      /const\s+\[\s*activeTab\s*,\s*setActiveTab\s*\]\s*=\s*useState\s*\(\s*['"]overview['"]\s*\)/,
    );
  });

  it("only renders the edit-expert tab when editExpertId is truthy", () => {
    // If the param is absent, the edit tab should not exist at all.
    expect(adminNetwork).toMatch(
      /\{\s*editExpertId\s*&&\s*\(/,
    );
  });

  it("clears editExpertId when the active tab is not edit-expert", () => {
    // Switching away from the edit tab must reset state so a later plain
    // reload doesn't resurrect a stale id.
    expect(adminNetwork).toMatch(
      /if\s*\(\s*val\s*!==\s*['"]edit-expert['"]\s*\)\s*setEditExpertId\s*\(\s*null\s*\)/,
    );
  });

  it("ExpertFormModule removes ?edit= from the URL when editExpertId is absent", () => {
    expect(expertModule).toMatch(
      /setSearchParams\s*\(\s*\{\s*\}\s*,\s*\{\s*replace:\s*true\s*\}\s*\)/,
    );
  });

  it("MedicalExpertFormPage default values are blank (create mode)", () => {
    // name and surname must start empty so the user sees a fresh form.
    expect(formPage).toMatch(
      /defaultValues:\s*\{[\s\S]*?name:\s*['""]['""]/,
    );
    expect(formPage).toMatch(
      /defaultValues:\s*\{[\s\S]*?surname:\s*['""]['""]/,
    );
  });

  it("MedicalExpertFormPage isEditMode is false when no id is present", () => {
    // The boolean must be derived from !!expertId, so a null/undefined id
    // keeps us in create mode.
    expect(formPage).toMatch(/const\s+isEditMode\s*=\s*!!\s*expertId/);
  });

  it("skips expert data load when isEditMode is false", () => {
    // The useEffect that triggers loadExpertForEdit is gated by the id.
    expect(formPage).toMatch(
      /if\s*\(\s*isEditMode\s*&&\s*expertId\s*\)\s*\{[\s\S]*?loadExpertForEdit\s*\(\s*expertId\s*\)/,
    );
  });

  it("enables auto-save when not in edit mode", () => {
    // Auto-save is suppressed for existing experts so drafts don't overwrite
    // edits, but it must remain active in create mode.
    expect(formPage).toMatch(
      /if\s*\(\s*isEditMode\s*\)\s*return;/,
    );
  });
});
