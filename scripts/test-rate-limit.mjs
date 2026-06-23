/**
 * Smoke test for the /api/reports rate limit (quick win 1c).
 *
 *   1. Create a fresh test user
 *   2. Upload one photo (re-used for all submissions)
 *   3. Submit 5 reports → all should succeed (200)
 *   4. Submit the 6th → should fail with 429 + Spanish message +
 *      Retry-After header
 *
 * Usage:  node scripts/test-rate-limit.mjs
 *
 * Cost: ~5 OpenAI Vision calls ($0.05). Run rarely.
 *
 * The rate-limit window is 5 minutes per user, so a successful run
 * locks the test user out for ~5 minutes. The cleanup script
 * (cleanup-e2e.mjs) doesn't reset reports_submitted on the profile,
 * so don't reuse the user.
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

const TEST_EMAIL = `e2e-rate-${Date.now()}@boketepr-test.local`;
const TEST_PASSWORD = "E2ERateLimit-2026!";
const MAX_REPORTS = 5;

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
pass(`user ${created.user.id} (${TEST_EMAIL})`);

const browser = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false },
});
const { data: signin, error: signinErr } = await browser.auth.signInWithPassword({
  email: TEST_EMAIL,
  password: TEST_PASSWORD,
});
if (signinErr || !signin.session) fail(signinErr?.message ?? "no session");
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
pass("session cookie crafted");

logStep(2, "POST /api/upload (single photo, reused)");
const uploadRes = await fetch(`${APP_URL}/api/upload`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie: cookies.join("; ") },
  body: JSON.stringify({ filename: "rate-limit-test.jpg", contentType: "image/jpeg" }),
});
if (!uploadRes.ok) fail(`upload failed: ${uploadRes.status} ${await uploadRes.text()}`);
const upload = await uploadRes.json();
pass(`signed URL issued (path: ${upload.path})`);

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
pass("photo uploaded");

logStep(3, `Submitting ${MAX_REPORTS} reports (should all succeed)`);
// Vary the lat/lng slightly so they don't all collide on the same point
// (and trigger duplicate-detection UI noise in case someone is watching).
const BASE_LAT = 18.4655;
const BASE_LNG = -66.1057;
const created_ids = [];
for (let i = 0; i < MAX_REPORTS; i++) {
  const res = await fetch(`${APP_URL}/api/reports`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookies.join("; ") },
    body: JSON.stringify({
      photo_url: upload.publicUrl,
      lat: BASE_LAT + i * 0.0005,
      lng: BASE_LNG + i * 0.0005,
      user_comment: `rate-limit test ${i + 1}/${MAX_REPORTS}`,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) fail(`submission ${i + 1} failed: ${res.status} ${JSON.stringify(body)}`);
  created_ids.push(body.id);
  process.stdout.write(`    ${i + 1}/${MAX_REPORTS} (${res.status}) id=${body.id}\n`);
}
pass(`all ${MAX_REPORTS} submissions accepted`);

logStep(4, `Submitting the 6th report (should be rate-limited)`);
const overLimitRes = await fetch(`${APP_URL}/api/reports`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie: cookies.join("; ") },
  body: JSON.stringify({
    photo_url: upload.publicUrl,
    lat: BASE_LAT,
    lng: BASE_LNG,
    user_comment: "should be blocked",
  }),
});
if (overLimitRes.status !== 429) {
  fail(`expected 429, got ${overLimitRes.status}: ${JSON.stringify(await overLimitRes.json().catch(() => ({})))}`);
}
pass("status 429");

const overLimitBody = await overLimitRes.json();
if (!overLimitBody.error || !overLimitBody.error.includes("Demasiados")) {
  fail(`expected Spanish 'Demasiados' error, got: ${JSON.stringify(overLimitBody)}`);
}
pass(`error message in Spanish: "${overLimitBody.error}"`);

const retryAfter = overLimitRes.headers.get("Retry-After");
if (!retryAfter || !/^\d+$/.test(retryAfter)) {
  fail(`expected Retry-After header with seconds, got: ${retryAfter}`);
}
const retryAfterSeconds = Number(retryAfter);
if (retryAfterSeconds < 60 || retryAfterSeconds > 600) {
  fail(`Retry-After should be ~300 (5 min), got ${retryAfterSeconds}`);
}
pass(`Retry-After header present: ${retryAfterSeconds}s (~5 min)`);

logStep(5, "Verifying rate limit is per-user (a second user is unaffected)");
// Create a second user, submit once, expect 200.
const OTHER_EMAIL = `e2e-rate-other-${Date.now()}@boketepr-test.local`;
const { data: created2, error: createErr2 } = await admin.auth.admin.createUser({
  email: OTHER_EMAIL,
  password: TEST_PASSWORD,
  email_confirm: true,
});
if (createErr2) fail(createErr2.message);
const browser2 = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false },
});
const { data: signin2 } = await browser2.auth.signInWithPassword({
  email: OTHER_EMAIL,
  password: TEST_PASSWORD,
});
const cookies2 = [
  `sb-${projectRef}-auth-token=${encodeURIComponent(
    JSON.stringify({
      access_token: signin2.session.access_token,
      refresh_token: signin2.session.refresh_token,
      expires_at: signin2.session.expires_at,
      expires_in: signin2.session.expires_in,
      token_type: "bearer",
      user: signin2.session.user,
    }),
  )}`,
];
const otherRes = await fetch(`${APP_URL}/api/reports`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie: cookies2.join("; ") },
  body: JSON.stringify({
    photo_url: upload.publicUrl,
    lat: BASE_LAT + 0.01,
    lng: BASE_LNG - 0.01,
    user_comment: "second user — should not be limited by the first",
  }),
});
if (otherRes.status !== 200) {
  fail(`second user's submission should succeed (200), got ${otherRes.status}: ${JSON.stringify(await otherRes.json().catch(() => ({})))}`);
}
pass("second user unaffected (200)");

console.log("\n✅ Rate limit works as expected.");
console.log("Test user 1:", TEST_EMAIL, "(locked out for ~5 min)");
console.log("Test user 2:", OTHER_EMAIL, "(created 1 report)");
console.log("\nCleanup: node scripts/cleanup-e2e.mjs --confirm");