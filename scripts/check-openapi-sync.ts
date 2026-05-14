#!/usr/bin/env bun
/**
 * CI check: ensures docs/openapi.yaml stays in sync with the supabase/functions/* routes.
 *
 * Rules:
 *  - Every directory under supabase/functions/ (except _shared) MUST have a matching
 *    `/<dir-name>:` path entry in docs/openapi.yaml.
 *  - Every path entry in docs/openapi.yaml MUST correspond to an existing edge function dir.
 *
 * Exits non-zero with a diff-style report when out of sync.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const FUNCTIONS_DIR = "supabase/functions";
const OPENAPI_PATH = "docs/openapi.yaml";
const IGNORED = new Set(["_shared"]);

function listFunctionRoutes(): string[] {
  return readdirSync(FUNCTIONS_DIR)
    .filter((name) => {
      if (IGNORED.has(name)) return false;
      const full = join(FUNCTIONS_DIR, name);
      try {
        return statSync(full).isDirectory();
      } catch {
        return false;
      }
    })
    .sort();
}

/** Extract top-level paths from the `paths:` block of an OpenAPI YAML file. */
function listOpenApiRoutes(yaml: string): string[] {
  const lines = yaml.split(/\r?\n/);
  const routes: string[] = [];
  let inPaths = false;
  for (const line of lines) {
    if (/^paths:\s*$/.test(line)) {
      inPaths = true;
      continue;
    }
    if (inPaths) {
      // Leaving the paths block: any non-indented, non-empty line that isn't a comment.
      if (/^\S/.test(line) && !line.startsWith("#")) break;
      // A path entry looks like: `  /route-name:` (exactly 2 spaces indent).
      const m = line.match(/^ {2}\/([A-Za-z0-9_\-\/{}]+):\s*$/);
      if (m) routes.push(m[1].split("/")[0]);
    }
  }
  return Array.from(new Set(routes)).sort();
}

const fnRoutes = listFunctionRoutes();
const yamlText = readFileSync(OPENAPI_PATH, "utf8");
const docRoutes = listOpenApiRoutes(yamlText);

const fnSet = new Set(fnRoutes);
const docSet = new Set(docRoutes);

const missingInDocs = fnRoutes.filter((r) => !docSet.has(r));
const orphanedInDocs = docRoutes.filter((r) => !fnSet.has(r));

if (missingInDocs.length === 0 && orphanedInDocs.length === 0) {
  console.log(
    `✅ openapi.yaml is in sync with ${fnRoutes.length} edge function routes.`,
  );
  process.exit(0);
}

console.error("❌ docs/openapi.yaml is out of date with edge function routes.\n");

if (missingInDocs.length) {
  console.error("Missing from docs/openapi.yaml (edge function exists, no spec):");
  for (const r of missingInDocs) console.error(`  + /${r}`);
  console.error("");
}
if (orphanedInDocs.length) {
  console.error("Orphaned in docs/openapi.yaml (spec exists, no edge function):");
  for (const r of orphanedInDocs) console.error(`  - /${r}`);
  console.error("");
}

console.error(
  "Update docs/openapi.yaml to add missing routes and remove orphaned ones, then re-run.",
);
process.exit(1);
