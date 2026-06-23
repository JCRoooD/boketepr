/**
 * Smoke test for the migration 0007 fixed-pin behavior.
 *
 *   1. Create a test user
 *   2. Submit a real report (POST /api/reports) — status='active', fixed_at=NULL
 *   3. Mark it fixed (POST /api/reports/[id]/fix) — status='fixed', fixed_at≈now
 *   4. Verify the row still exists in the DB (not deleted) with both
 *      status='fixed' and a recent fixed_at
 *   5. Verify the /map query filter (status='active' OR fixed_at > now()-30d)
 *      INCLUDES the freshly-fixed row (server-side PostgREST)
 *   6. Backdate fixed_at to 31 days ago → verify the same filter EXCLUDES it
 *   7. Restore fixed_at → cleanup via cleanup-e2e.mjs
 *
 * Usage:  node scripts/test-fixed-pin.mjs
 *
 * No OpenAI calls (we use a fake JPEG like e2e-submit.mjs, but if the
 * scoring call happens it'll still complete — the assertions don't
 * depend on the AI score).
 */

import { readFileSync } from "node:fs";

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
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = process.env.BOKETEPR_TEST_APP_URL ?? "https://boketepr.vercel.app";

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error("Missing Supabase env vars in .env.local");
  process.exit(1);
}

const { createClient } = await import("@supabase/supabase-js");

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_EMAIL = `e2e-fixed-${Date.now()}@boketepr-test.local`;
const TEST_PASSWORD = "E2EFixedPass2026!";

function logStep(n, msg) {
  console.log(`${n}. ${msg}…`);
}
function pass(msg) {
  console.log("  ✓", msg);
}
function fail(msg) {
  console.error("  ✗", msg);
  process.exit(1);
}

logStep(1, "Creating test user");
const { data: created, error: createErr } = await admin.auth.admin.createUser({
  email: TEST_EMAIL,
  password: TEST_PASSWORD,
  email_confirm: true,
});
if (createErr) fail(createErr.message);
pass(`user ${created.user.id}`);

const browser = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false },
});
const { data: signin } = await browser.auth.signInWithPassword({
  email: TEST_EMAIL,
  password: TEST_PASSWORD,
});
const accessToken = signin.session.access_token;
const projectRef = SUPABASE_URL.match(/https?:\/\/([^.]+)/)[1];
const cookies = [
  `sb-${projectRef}-auth-token=${encodeURIComponent(
    JSON.stringify({
      access_token: accessToken,
      refresh_token: signin.session.refresh_token,
      expires_at: signin.session.expires_at,
      expires_in: signin.session.expires_in,
      token_type: "bearer",
      user: signin.session.user,
    }),
  )}`,
];

logStep(2, "Uploading one photo + submitting a report");
const uploadRes = await fetch(`${APP_URL}/api/upload`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie: cookies.join("; ") },
  body: JSON.stringify({
    filename: "fixed-pin-test.jpg",
    contentType: "image/jpeg",
  }),
});
if (!uploadRes.ok) fail(`upload failed: ${uploadRes.status}`);
const upload = await uploadRes.json();

// 1x1 red JPEG
const fakeJpeg = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAr/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AB//Z",
  "base64",
);
const putRes = await fetch(upload.signedUrl, {
  method: "PUT",
  headers: { "content-type": "image/jpeg" },
  body: fakeJpeg,
});
if (!putRes.ok) fail(`upload PUT failed: ${putRes.status}`);

const reportRes = await fetch(`${APP_URL}/api/reports`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie: cookies.join("; ") },
  body: JSON.stringify({
    photo_url: upload.publicUrl,
    lat: 18.4655,
    lng: -66.1057,
    user_comment: "fixed-pin smoke test",
  }),
});
if (!reportRes.ok) {
  fail(`report failed: ${reportRes.status} ${JSON.stringify(await reportRes.json().catch(() => ({})))}`);
}
const report = await reportRes.json();
pass(`report ${report.id} created`);

const { data: row0 } = await admin
  .from("reports")
  .select("status, fixed_at")
  .eq("id", report.id)
  .single();
if (row0.status !== "active") fail(`expected status='active', got '${row0.status}'`);
if (row0.fixed_at !== null) fail(`expected fixed_at=NULL on a fresh report, got '${row0.fixed_at}'`);
pass("status='active', fixed_at=NULL");

logStep(3, "Marking it fixed (POST /api/reports/[id]/fix)");
const fixRes = await fetch(`${APP_URL}/api/reports/${report.id}/fix`, {
  method: "POST",
  headers: { cookie: cookies.join("; ") },
});
if (!fixRes.ok) fail(`fix failed: ${fixRes.status} ${await fixRes.text()}`);
const fixBody = await fixRes.json();
pass(`fix returned: status='${fixBody.status}', fixed_at='${fixBody.fixed_at}'`);

logStep(4, "Verifying DB row still exists (not deleted)");
const { data: row1 } = await admin
  .from("reports")
  .select("id, status, fixed_at, lat, lng")
  .eq("id", report.id)
  .single();
if (!row1) fail("row vanished — should still exist");
if (row1.status !== "fixed") fail(`status should be 'fixed', got '${row1.status}'`);
if (!row1.fixed_at) fail("fixed_at should be set, got NULL");
const fixedMs = new Date(row1.fixed_at).getTime();
const ageMs = Date.now() - fixedMs;
if (ageMs > 60_000) fail(`fixed_at is suspiciously old (${ageMs}ms)`);
pass(`row exists, status='fixed', fixed_at is ${Math.round(ageMs / 1000)}s ago`);

logStep(5, "Verifying the /map query filter INCLUDES the fresh-fixed row");
// Mirrors what app/(public)/map/page.tsx does server-side:
//   .or(`status.eq.active,fixed_at.gt.${cutoffIso}`)
const freshCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
const { data: included } = await admin
  .from("reports")
  .select("id, status, fixed_at")
  .or(`status.eq.active,fixed_at.gt.${freshCutoff}`)
  .eq("id", report.id);
if (!included || included.length !== 1) {
  fail(`fresh-fixed row should appear in /map filter, got: ${JSON.stringify(included)}`);
}
pass("fresh-fixed row is included in the /map fetch filter");

logStep(6, "Backdating fixed_at to 31 days ago → row should drop off /map");
const OLD_DATE = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
const { error: backErr } = await admin
  .from("reports")
  .update({ fixed_at: OLD_DATE })
  .eq("id", report.id);
if (backErr) fail(`backdate failed: ${backErr.message}`);

const { data: excluded } = await admin
  .from("reports")
  .select("id, status, fixed_at")
  .or(`status.eq.active,fixed_at.gt.${freshCutoff}`)
  .eq("id", report.id);
if (excluded && excluded.length !== 0) {
  fail(`old-fixed row should NOT appear in /map filter, got: ${JSON.stringify(excluded)}`);
}
pass("31-day-old fixed row is excluded from the /map fetch filter");

// Restore for cleanup
await admin
  .from("reports")
  .update({ fixed_at: new Date().toISOString() })
  .eq("id", report.id);

console.log("\n✅ Fixed-pin behavior works as expected.");
console.log("Report ID:", report.id);
console.log("Test user:", TEST_EMAIL);
console.log("\nCleanup: node scripts/cleanup-e2e.mjs --confirm");