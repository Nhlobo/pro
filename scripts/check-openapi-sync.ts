#!/usr/bin/env bun
/**
 * CI check: ensures docs/openapi.yaml stays in sync with supabase/functions/* routes
 * AND that the HTTP methods documented per path match what each edge function actually accepts.
 *
 * Route detection:
 *  - Each directory under supabase/functions/ (except _shared) must have a matching
 *    `/<dir-name>:` entry in docs/openapi.yaml.
 *
 * Method detection (per edge function):
 *  - Scan index.ts for `req.method === '<METHOD>'` (excluding OPTIONS — that's CORS).
 *  - Scan for `req.method !== '<METHOD>'` (means: only that method is allowed).
 *  - If no explicit method check is found, default to POST (Supabase convention).
 *
 * OpenAPI side:
 *  - Parse operations (get/post/put/delete/patch) under each `paths:` entry.
 *
 * Exits non-zero with a diff-style report when out of sync.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const FUNCTIONS_DIR = "supabase/functions";
const OPENAPI_PATH = "docs/openapi.yaml";
const IGNORED_DIRS = new Set(["_shared"]);
const HTTP_METHODS = new Set([
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "HEAD",
]);

function listFunctionRoutes(): string[] {
  return readdirSync(FUNCTIONS_DIR)
    .filter((name) => {
      if (IGNORED_DIRS.has(name)) return false;
      try {
        return statSync(join(FUNCTIONS_DIR, name)).isDirectory();
      } catch {
        return false;
      }
    })
    .sort();
}

function detectFunctionMethods(route: string): Set<string> {
  const indexPath = join(FUNCTIONS_DIR, route, "index.ts");
  let src = "";
  try {
    src = readFileSync(indexPath, "utf8");
  } catch {
    return new Set(["POST"]);
  }
  const methods = new Set<string>();

  // `req.method === 'X'` — every non-OPTIONS branch is a supported method.
  for (const m of src.matchAll(
    /req\.method\s*===\s*['"`]([A-Z]+)['"`]/g,
  )) {
    const verb = m[1].toUpperCase();
    if (HTTP_METHODS.has(verb)) methods.add(verb);
  }

  // `req.method !== 'X'` — that X is the only allowed method (others are rejected).
  for (const m of src.matchAll(
    /req\.method\s*!==\s*['"`]([A-Z]+)['"`]/g,
  )) {
    const verb = m[1].toUpperCase();
    if (HTTP_METHODS.has(verb)) methods.add(verb);
  }

  // No explicit check → assume POST (default for Supabase edge functions).
  if (methods.size === 0) methods.add("POST");
  return methods;
}

/**
 * Extract { route → Set<method> } from the `paths:` block of an OpenAPI YAML.
 * Path entries live at 2-space indent, operations at 4-space indent.
 */
function parseOpenApiPaths(yaml: string): Map<string, Set<string>> {
  const lines = yaml.split(/\r?\n/);
  const result = new Map<string, Set<string>>();
  let inPaths = false;
  let currentRoute: string | null = null;

  for (const line of lines) {
    if (/^paths:\s*$/.test(line)) {
      inPaths = true;
      continue;
    }
    if (!inPaths) continue;
    // Leaving paths block: any non-indented, non-empty, non-comment line.
    if (/^\S/.test(line) && !line.startsWith("#")) break;

    const pathMatch = line.match(/^ {2}\/([A-Za-z0-9_\-\/{}]+):\s*$/);
    if (pathMatch) {
      currentRoute = pathMatch[1].split("/")[0];
      if (!result.has(currentRoute)) result.set(currentRoute, new Set());
      continue;
    }
    if (!currentRoute) continue;

    const opMatch = line.match(
      /^ {4}(get|post|put|delete|patch|head):\s*$/,
    );
    if (opMatch) {
      result.get(currentRoute)!.add(opMatch[1].toUpperCase());
    }
  }
  return result;
}

const fnRoutes = listFunctionRoutes();
const yamlText = readFileSync(OPENAPI_PATH, "utf8");
const docMap = parseOpenApiPaths(yamlText);

const fnSet = new Set(fnRoutes);
const missingInDocs = fnRoutes.filter((r) => !docMap.has(r));
const orphanedInDocs = [...docMap.keys()]
  .filter((r) => !fnSet.has(r))
  .sort();

const methodMismatches: Array<{
  route: string;
  inCodeOnly: string[];
  inSpecOnly: string[];
}> = [];

for (const route of fnRoutes) {
  if (!docMap.has(route)) continue; // already reported above
  const codeMethods = detectFunctionMethods(route);
  const specMethods = docMap.get(route)!;
  const inCodeOnly = [...codeMethods].filter((m) => !specMethods.has(m)).sort();
  const inSpecOnly = [...specMethods].filter((m) => !codeMethods.has(m)).sort();
  if (inCodeOnly.length || inSpecOnly.length) {
    methodMismatches.push({ route, inCodeOnly, inSpecOnly });
  }
}

const ok =
  missingInDocs.length === 0 &&
  orphanedInDocs.length === 0 &&
  methodMismatches.length === 0;

if (ok) {
  console.log(
    `✅ openapi.yaml is in sync with ${fnRoutes.length} edge function routes (paths + methods).`,
  );
  process.exit(0);
}

console.error("❌ docs/openapi.yaml is out of sync with edge functions.\n");

if (missingInDocs.length) {
  console.error("Missing from docs/openapi.yaml (function exists, no spec):");
  for (const r of missingInDocs) console.error(`  + /${r}`);
  console.error("");
}
if (orphanedInDocs.length) {
  console.error("Orphaned in docs/openapi.yaml (spec exists, no function):");
  for (const r of orphanedInDocs) console.error(`  - /${r}`);
  console.error("");
}
if (methodMismatches.length) {
  console.error("HTTP method mismatches:");
  for (const { route, inCodeOnly, inSpecOnly } of methodMismatches) {
    console.error(`  /${route}`);
    for (const m of inCodeOnly)
      console.error(`    + ${m.toLowerCase()}: (in code, missing from spec)`);
    for (const m of inSpecOnly)
      console.error(`    - ${m.toLowerCase()}: (in spec, not in code)`);
  }
  console.error("");
}

console.error(
  "Update docs/openapi.yaml or the edge function so the routes and methods match, then re-run.",
);
process.exit(1);
