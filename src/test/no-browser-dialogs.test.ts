/**
 * Guardrail test: ensures no browser-native confirmation dialogs are reintroduced.
 *
 * Verifies:
 *  1. No `beforeunload` listener calls `preventDefault()` or sets `returnValue`
 *     (which is what triggers the browser's "Leave site?" popup).
 *  2. No `window.confirm(...)` calls exist in production source files —
 *     destructive actions must use the in-app AlertDialog component instead.
 *
 * Test files, this guard itself, and the shadcn alert-dialog primitive are excluded.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const SRC_DIR = join(__dirname, '..');

const EXCLUDE_PATTERNS = [
  /\.test\.(ts|tsx)$/,
  /\.spec\.(ts|tsx)$/,
  /__tests__\//,
  /\/test\//,
  /components\/ui\/alert-dialog\.tsx$/,
];

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, files);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      const rel = relative(SRC_DIR, full);
      if (!EXCLUDE_PATTERNS.some((p) => p.test(rel))) files.push(full);
    }
  }
  return files;
}

const sourceFiles = walk(SRC_DIR);

describe('No browser-native dialogs', () => {
  it('does not call preventDefault or set returnValue inside beforeunload handlers', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles) {
      const content = readFileSync(file, 'utf8');
      if (!content.includes('beforeunload')) continue;

      // Find each addEventListener('beforeunload', ...) handler scope
      // and check whether preventDefault() or returnValue is used in the file.
      // Heuristic: if file has both `beforeunload` and (`preventDefault()` or `returnValue`),
      // flag it. Strip line comments first to avoid false positives.
      const stripped = content
        .split('\n')
        .map((l) => l.replace(/\/\/.*$/, ''))
        .join('\n');

      if (
        stripped.includes('beforeunload') &&
        (/\.preventDefault\s*\(/.test(stripped) || /\.returnValue\s*=/.test(stripped))
      ) {
        // Confirm the preventDefault/returnValue is associated with a beforeunload handler
        // (not unrelated). Look for them within ~400 chars of a beforeunload mention.
        const idx = stripped.indexOf('beforeunload');
        const window = stripped.slice(Math.max(0, idx - 50), idx + 600);
        if (
          /\.preventDefault\s*\(/.test(window) ||
          /\.returnValue\s*=/.test(window)
        ) {
          offenders.push(relative(SRC_DIR, file));
        }
      }
    }
    expect(offenders, `Files using beforeunload popup:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('does not use window.confirm() — destructive actions must use AlertDialog', () => {
    const offenders: { file: string; line: number; text: string }[] = [];
    for (const file of sourceFiles) {
      const content = readFileSync(file, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        const stripped = line.replace(/\/\/.*$/, '');
        if (/\bwindow\.confirm\s*\(/.test(stripped)) {
          offenders.push({ file: relative(SRC_DIR, file), line: i + 1, text: line.trim() });
        }
      });
    }
    const msg = offenders
      .map((o) => `${o.file}:${o.line} → ${o.text}`)
      .join('\n');
    expect(offenders, `window.confirm() usages found:\n${msg}`).toEqual([]);
  });
});
