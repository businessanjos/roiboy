#!/usr/bin/env node
/**
 * Generates `dist/version.json` after every production build so the running
 * app can detect when a new deploy has shipped and prompt users to reload —
 * eliminating the need for Ctrl+Shift+R after a publish.
 *
 * The version string mixes a build timestamp with a short random suffix to
 * guarantee uniqueness even when two builds run in the same second.
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const distDir = join(process.cwd(), "dist");
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

const version = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const payload = {
  version,
  builtAt: new Date().toISOString(),
};

writeFileSync(join(distDir, "version.json"), JSON.stringify(payload, null, 2));
console.log(`[version] wrote dist/version.json -> ${version}`);
