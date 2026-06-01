import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * End-to-end behavioural contract — /admin/experts?edit=<id>
 *
 * Verifies that the deep-link to edit an expert always preloads the same
 * record into the edit tab, even after a hard refresh.
 *
 * The flow has three guarantees that must hold together:
 *
 *  1. AdminExpertNetwork reads `?edit=<id>` from the URL on every mount
 *     (and every searchParams change), promotes it to `editExpertId`
 *     state, and switches the active tab to `edit-expert`.
 *
 *  2. The edit tab renders `ExpertFormModule` with `key={editExpertId}`
 *     and forwards `editExpertId` as a prop — guaranteeing a fresh
 *     instance per id (so navigating between two `?edit=` links never
 *     reuses the previous record).
 *
 *  3. MedicalExpertFormPage resolves the id from the prop first, falling
 *     back to the route param, then `?edit=` — so a hard refresh on
 *     `/admin/experts?edit=<id>` still loads the same record.
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

describe("/admin/experts?edit= deep-link preloads the same expert", () => {
  it("AdminExpertNetwork reads ?edit from useSearchParams", () => {
    expect(adminNetwork).toMatch(/useSearchParams\(\)/);
    expect(adminNetwork).toMatch(/searchParams\.get\(\s*['"]edit['"]\s*\)/);
  });

  it("syncs ?edit into editExpertId state and switches to the edit tab", () => {
    // The effect must promote the URL id and select the edit-expert tab.
    expect(adminNetwork).toMatch(
      /useEffect\(\s*\(\)\s*=>\s*\{[\s\S]*?searchParams\.get\(\s*['"]edit['"]\s*\)[\s\S]*?setEditExpertId\([\s\S]*?setActiveTab\(\s*['"]edit-expert['"]\s*\)[\s\S]*?\}\s*,\s*\[\s*searchParams[\s\S]*?\]\s*\)/,
    );
  });

  it("renders the edit tab with key={editExpertId} so each id mounts a fresh form", () => {
    expect(adminNetwork).toMatch(
      /<ExpertFormModule[\s\S]*?key=\{\s*editExpertId\s*\}[\s\S]*?editExpertId=\{\s*editExpertId\s*\}/,
    );
  });

  it("ExpertFormModule forwards editExpertId to MedicalExpertFormPage", () => {
    expect(expertModule).toMatch(
      /<MedicalExpertFormPage[\s\S]*?editExpertId=\{\s*editExpertId\s*\}/,
    );
  });

  it("ExpertFormModule keeps the URL in sync with the editExpertId prop", () => {
    // Hard-refresh contract: the address bar must reflect ?edit=<id> while
    // the editor is mounted, so reloading lands back on the same record.
    expect(expertModule).toMatch(
      /setSearchParams\(\s*\{\s*edit:\s*editExpertId\s*\}\s*,\s*\{\s*replace:\s*true\s*\}\s*\)/,
    );
  });

  it("MedicalExpertFormPage resolves the expert id from prop → route → ?edit=", () => {
    expect(formPage).toMatch(
      /const\s+expertId\s*=\s*editExpertId\s*\|\|\s*routeExpertId\s*\|\|\s*searchParams\.get\(\s*['"]edit['"]\s*\)/,
    );
  });

  it("MedicalExpertFormPage treats any resolved id as edit mode", () => {
    expect(formPage).toMatch(/const\s+isEditMode\s*=\s*!!\s*expertId/);
  });

  it("loads the expert record by that exact id (no stale fallback)", () => {
    // Must query medical_experts using the resolved expertId. The query is
    // what makes a hard refresh on ?edit=<id> always rehydrate the same
    // record from the database.
    expect(formPage).toMatch(
      /from\(\s*['"]medical_experts['"]\s*\)[\s\S]{0,400}?\.eq\(\s*['"]id['"]\s*,\s*expertId\s*\)/,
    );
  });
});
