#!/usr/bin/env node
/**
 * Pre-deploy guard for Supabase Edge Functions.
 *
 * Scans `supabase/functions/**\/*.ts` for known-problematic imports that
 * historically broke the Supabase bundler (e.g. flaky `deno.land/std` modules)
 * and exits non-zero with a clear message so the deploy is aborted before the
 * Supabase codegen error is raised.
 *
 * Usage:
 *   node scripts/check-edge-imports.mjs
 *
 * Exit codes:
 *   0 — clean, safe to deploy
 *   1 — problematic imports found, deploy should be blocked
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const FUNCTIONS_DIR = join(ROOT, "supabase", "functions");

// Patterns that have caused bundle failures in production.
// Each rule: { pattern: RegExp, reason: string, fix: string }
const FORBIDDEN_PATTERNS = [
  {
    pattern: /https:\/\/deno\.land\/std@[\d.]+\/http\/server\.ts/g,
    reason:
      "deno.land/std http/server is unstable on the Supabase bundler (intermittent 500s).",
    fix: "Remove the import and use the native `Deno.serve(...)` API instead.",
  },
  {
    pattern: /https:\/\/deno\.land\/std@[\d.]+\/async\/mod\.ts/g,
    reason:
      "deno.land/std async/mod has been failing the Supabase bundler with 500 errors.",
    fix: "Inline the helpers you need or import from `npm:` specifiers.",
  },
];

/** Recursively collect all .ts files under a directory. */
function collectTsFiles(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...collectTsFiles(full));
    } else if (st.isFile() && full.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

const files = collectTsFiles(FUNCTIONS_DIR);
const violations = [];

for (const file of files) {
  const content = readFileSync(file, "utf8");
  const lines = content.split("\n");

  for (const rule of FORBIDDEN_PATTERNS) {
    lines.forEach((line, idx) => {
      // Reset regex state since `g` flag is used.
      rule.pattern.lastIndex = 0;
      if (rule.pattern.test(line)) {
        violations.push({
          file: relative(ROOT, file),
          line: idx + 1,
          snippet: line.trim(),
          reason: rule.reason,
          fix: rule.fix,
        });
      }
    });
  }
}

if (violations.length === 0) {
  console.log(
    `✅ Edge functions OK — scanned ${files.length} file(s), no forbidden imports.`,
  );
  process.exit(0);
}

console.error("\n❌ Deploy blocked: forbidden imports detected\n");
console.error(
  `Found ${violations.length} occurrence(s) across ${
    new Set(violations.map((v) => v.file)).size
  } file(s).\n`,
);

for (const v of violations) {
  console.error(`  • ${v.file}:${v.line}`);
  console.error(`      ${v.snippet}`);
  console.error(`      ↳ Reason: ${v.reason}`);
  console.error(`      ↳ Fix:    ${v.fix}\n`);
}

console.error(
  "Tip: replace `import { serve } from \"https://deno.land/std@.../http/server.ts\";`",
);
console.error(
  "     with the native runtime API: `Deno.serve(async (req) => { ... });`\n",
);

process.exit(1);
