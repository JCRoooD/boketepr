/**
 * Cleanup script for Goal 3 e2e test data.
 *
 *   1. Find all auth.users with email LIKE 'e2e-test-%@boketepr-test.local'
 *   2. List + delete their files in the `photos` bucket
 *   3. Delete their rows in public.reports (FK is ON DELETE SET NULL,
 *      so deleting the user would NOT cascade the report row away)
 *   4. Delete the auth.users (cascades to public.profiles automatically)
 *
 * Usage:
 *   node scripts/cleanup-e2e.mjs            # dry run (default)
 *   node scripts/cleanup-e2e.mjs --confirm  # actually delete
 *
 * Reads .env.local for SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */

import { readFileSync } from "node:fs";

const CONFIRM = process.argv.includes("--confirm");

// --- Load .env.local ---
const envText = readFileSync(
  "C:/Users/juanc/Projects/boketepr/.env.local",
  "utf8",
);
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
  if (m && !process.env[m[1]]) {
    process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE env vars in .env.local");
  process.exit(1);
}

const { createClient } = await import("@supabase/supabase-js");

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Test users are any email in the @boketepr-test.local domain whose
// local-part starts with one of these prefixes. Each test script uses
// its own prefix so the cleanup script can target them all without
// needing to know which test created which user.
const TEST_PREFIXES = ["e2e-test-", "e2e-fixed-", "e2e-rate-", "e2e-rate-other-"];
const DOMAIN = "@boketepr-test.local";

function isTestUser(email) {
  if (!email?.endsWith(DOMAIN)) return false;
  return TEST_PREFIXES.some((p) => email.startsWith(p));
}

console.log(
  CONFIRM
    ? "🧹 CLEANUP MODE (will delete)\n"
    : "🔍 DRY RUN (pass --confirm to actually delete)\n",
);

// --- 1. Find e2e test users ---
// admin.listUsers is paginated; pull enough pages to find them all.
const testUsers = [];
let page = 1;
while (true) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
  if (error) {
    console.error("listUsers failed:", error.message);
    process.exit(1);
  }
  for (const u of data.users) {
    if (isTestUser(u.email)) {
      testUsers.push(u);
    }
  }
  if (data.users.length < 100) break;
  page++;
}

console.log(`Found ${testUsers.length} e2e test user(s):`);
for (const u of testUsers) {
  console.log(`  - ${u.email}  (id: ${u.id})`);
}
if (testUsers.length === 0) {
  console.log("Nothing to clean. Exiting.");
  process.exit(0);
}

// --- 2. Storage files in their folders ---
let totalFiles = 0;
const filesToDelete = [];
for (const u of testUsers) {
  const { data: files, error } = await admin.storage
    .from("photos")
    .list(u.id, { limit: 100 });
  if (error) {
    console.error(`  list(${u.id}) failed:`, error.message);
    continue;
  }
  for (const f of files ?? []) {
    const path = `${u.id}/${f.name}`;
    filesToDelete.push(path);
    totalFiles++;
  }
}
console.log(`\nStorage files to delete: ${totalFiles}`);
for (const p of filesToDelete) {
  console.log(`  - photos/${p}`);
}

// --- 3. Reports rows for these users ---
const userIds = testUsers.map((u) => u.id);
const { data: reportRows, error: repErr } = await admin
  .from("reports")
  .select("id, user_id, geohash, severity, created_at")
  .in("user_id", userIds);

if (repErr) {
  console.error("\nreports query failed:", repErr.message);
  process.exit(1);
}
console.log(`\nReports rows to delete: ${reportRows.length}`);
for (const r of reportRows ?? []) {
  console.log(
    `  - id: ${r.id}  geohash: ${r.geohash}  severity: ${r.severity}  created: ${r.created_at}`,
  );
}

// --- 4. Profile rows (informational; cascade auto-deletes when auth.user is deleted) ---
const { data: profileRows, error: profErr } = await admin
  .from("profiles")
  .select("id, display_name, reports_submitted")
  .in("id", userIds);
if (profErr) {
  console.error("\nprofiles query failed:", profErr.message);
  process.exit(1);
}
console.log(`\nProfile rows to cascade-delete: ${profileRows.length}`);
for (const p of profileRows ?? []) {
  console.log(
    `  - id: ${p.id}  name: ${p.display_name}  reports_submitted: ${p.reports_submitted}`,
  );
}

if (!CONFIRM) {
  console.log("\n(no changes made — pass --confirm to actually delete)");
  process.exit(0);
}

// ============================================================
// ACTUAL DELETION
// ============================================================

console.log("\n--- Deleting ---");

// Storage files first (so we can fail visibly if bucket perms are wrong)
if (filesToDelete.length > 0) {
  const { error: delFilesErr } = await admin.storage
    .from("photos")
    .remove(filesToDelete);
  if (delFilesErr) {
    console.error("storage remove failed:", delFilesErr.message);
    process.exit(1);
  }
  console.log(`  ✓ deleted ${filesToDelete.length} storage file(s)`);
}

// Reports rows (FK is ON DELETE SET NULL, so we delete manually)
if ((reportRows ?? []).length > 0) {
  const { error: delRepErr } = await admin
    .from("reports")
    .delete()
    .in("user_id", userIds);
  if (delRepErr) {
    console.error("reports delete failed:", delRepErr.message);
    process.exit(1);
  }
  console.log(`  ✓ deleted ${reportRows.length} reports row(s)`);
}

// Auth users (cascades to profiles)
for (const u of testUsers) {
  const { error: delUserErr } = await admin.auth.admin.deleteUser(u.id);
  if (delUserErr) {
    console.error(`  ✗ delete user ${u.email} failed:`, delUserErr.message);
    continue;
  }
  console.log(`  ✓ deleted auth user ${u.email}`);
}

console.log("\n✅ Cleanup complete.");
