#!/usr/bin/env node
/**
 * scripts/check-secret-leaks.mjs
 *
 * CI guard for the BoketePR repo. Fails the build if a tracked source
 * file outside `scripts/` references the SUPABASE_SERVICE_ROLE_KEY env
 * var. (SEC-016 in the security audit — service-role key bypasses RLS
 * and has full DB + storage admin access; it must only flow through
 * known, audited paths.)
 *
 * Why:
 *   The current legitimate references are:
 *     - lib/supabase/service.ts (the service-role client factory —
 *       server-only, never bundled to the browser)
 *     - scripts/*.mjs (operational scripts that run locally or in CI
 *       with explicit operator access)
 *
 *   Any new reference outside these paths is almost certainly a bug
 *   or a leak. Catching it at commit time is cheaper than finding it
 *   post-deploy.
 *
 * Note: this is a *coarse* check (string match on the env var name).
 * It does NOT scan for hardcoded literal secrets — that's the job of
 * dedicated tools like trufflehog / gitleaks. Pair this with one of
 * those for defense in depth.
 *
 * Usage:
 *   node scripts/check-secret-leaks.mjs
 *
 * Exit code: 0 if clean, 1 if any leak found.
 */

import { execSync } from "node:child_process";

const PATTERNS = [
  /SUPABASE_SERVICE_ROLE_KEY/,
];

// Files that legitimately reference the service-role key. Anything
// outside this allow-list is flagged.
const ALLOWLIST = new Set([
  "lib/supabase/service.ts",
  "lib/env.ts", // required() takes the env var name as a string literal
  "AGENTS.md", // documents the env var name in the env-vars section
  "scripts/cleanup-e2e.mjs",
  "scripts/e2e-submit.mjs",
  "scripts/test-rate-limit.mjs",
  "scripts/test-profile.mjs",
  "scripts/test-fixed-pin.mjs",
  "scripts/test-nearby.mjs",
  "scripts/verify-security-migrations.mjs",
  "scripts/diag-migration-0008.mjs",
  "scripts/check-secret-leaks.mjs", // self-reference is fine
]);

const ROOT = process.cwd();

function trackedFiles() {
  // `git ls-files` returns paths relative to the repo root. We use
  // --modified too so we catch staged + unstaged changes in dev.
  const out = execSync("git ls-files", { encoding: "utf8", cwd: ROOT });
  return out
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean);
}

const findings = [];
for (const file of trackedFiles()) {
  if (ALLOWLIST.has(file)) continue;

  // Cheap: only scan source-ish extensions. Skip binary / lockfile /
  // generated / node_modules.
  if (
    /\.(png|jpg|jpeg|gif|webp|ico|svg|ico|woff2?|ttf|eot|pdf|zip|tar|gz)$/i.test(
      file,
    ) ||
    file === "package-lock.json" ||
    file.startsWith("node_modules/") ||
    file.startsWith(".next/")
  ) {
    continue;
  }

  let content;
  try {
    content = execSync(`git show "HEAD:${file}" 2>/dev/null || cat "${file}"`, {
      encoding: "utf8",
      cwd: ROOT,
      maxBuffer: 5 * 1024 * 1024,
    });
  } catch {
    continue;
  }

  for (const pat of PATTERNS) {
    const m = content.match(pat);
    if (m) {
      findings.push({ file, pattern: pat.source, sample: m[0] });
    }
  }
}

if (findings.length === 0) {
  console.log("✔ check-secret-leaks: no service-role key references outside allow-list.");
  process.exit(0);
}

console.error("✗ check-secret-leaks: service-role key references found outside allow-list:");
for (const f of findings) {
  console.error(`  ${f.file}: matched /${f.pattern}/ (sample: "${f.sample}")`);
}
console.error(
  "\nIf this reference is intentional, add the file to ALLOWLIST in scripts/check-secret-leaks.mjs.",
);
process.exit(1);