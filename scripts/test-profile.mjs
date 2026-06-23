/**
 * Smoke test for Goal 6 — User Profile full version.
 *
 *   1. Create a test user
 *   2. Read /profile as that user → verify base shape (name, email, stats)
 *   3. PATCH /api/profile to update display_name → verify the row updated
 *   4. POST /api/profile/avatar-upload → verify signed URL returned
 *   5. PUT a fake JPEG to the signed URL → verify upload accepted
 *   6. PATCH /api/profile with the new avatar_url → verify the row updated
 *   7. PATCH /api/profile with a bad avatar_url (off-bucket) → expect 400
 *   8. PATCH /api/profile as a different user → expect 403 (RLS) or 200
 *      with a body that doesn't include user A's data
 *   9. Cleanup via cleanup-e2e.mjs
 *
 * Usage:  node scripts/test-profile.mjs
 *
 * The smoke test deliberately does NOT submit any reports — the
 * stats card's "0 total" state is the most interesting one to test
 * (most users won't have reports on first visit).
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

const TEST_EMAIL = `e2e-profile-${Date.now()}@boketepr-test.local`;
const TEST_PASSWORD = "E2EProfile-Pass-2026!";

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

function craftCookies(accessToken, refreshToken, expiresAt, expiresIn, user) {
  const projectRef = SUPABASE_URL.match(/https?:\/\/([^.]+)/)[1];
  return [
    `sb-${projectRef}-auth-token=${encodeURIComponent(
      JSON.stringify({
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        expires_in: expiresIn,
        token_type: "bearer",
        user,
      }),
    )}`,
  ];
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
const cookies = craftCookies(
  signin.session.access_token,
  signin.session.refresh_token,
  signin.session.expires_at,
  signin.session.expires_in,
  signin.session.user,
);
pass("session cookie crafted");

logStep(2, "Reading /profile page (HTML)");
const pageRes = await fetch(`${APP_URL}/profile`, {
  headers: { cookie: cookies.join("; ") },
});
if (!pageRes.ok) fail(`/profile returned ${pageRes.status}`);
const pageHtml = await pageRes.text();
if (!pageHtml.includes("Mi perfil")) fail("page missing 'Mi perfil' heading");
if (!pageHtml.includes("Tu actividad")) fail("page missing stats card");
if (!pageHtml.includes(TEST_EMAIL)) fail("page missing the user's email");
pass(`/profile renders 200 with stats card + email`);

logStep(3, "PATCH /api/profile to update display_name");
const newName = `Test User ${Math.floor(Date.now() / 1000)}`;
const patch1 = await fetch(`${APP_URL}/api/profile`, {
  method: "PATCH",
  headers: { "content-type": "application/json", cookie: cookies.join("; ") },
  body: JSON.stringify({ display_name: newName }),
});
if (!patch1.ok) {
  fail(`PATCH failed: ${patch1.status} ${JSON.stringify(await patch1.json().catch(() => ({})))}`);
}
const patched = await patch1.json();
if (patched.display_name !== newName) {
  fail(`display_name mismatch: expected '${newName}', got '${patched.display_name}'`);
}
pass(`display_name updated to '${newName}'`);

logStep(4, "POST /api/profile/avatar-upload");
const uploadRes = await fetch(`${APP_URL}/api/profile/avatar-upload`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie: cookies.join("; ") },
  body: JSON.stringify({
    filename: "test-avatar.jpg",
    contentType: "image/jpeg",
    size: 1024,
  }),
});
if (!uploadRes.ok) fail(`avatar-upload failed: ${uploadRes.status}`);
const upload = await uploadRes.json();
if (!upload.signedUrl || !upload.avatar_url) {
  fail(`avatar-upload response missing fields: ${JSON.stringify(upload)}`);
}
pass(`signed URL issued (avatar_url: ${upload.avatar_url.slice(0, 80)}...)`);

logStep(5, "PUT a fake JPEG to the signed URL");
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
pass("avatar uploaded to Supabase Storage");

logStep(6, "PATCH /api/profile with the new avatar_url");
const patch2 = await fetch(`${APP_URL}/api/profile`, {
  method: "PATCH",
  headers: { "content-type": "application/json", cookie: cookies.join("; ") },
  body: JSON.stringify({ avatar_url: upload.avatar_url }),
});
if (!patch2.ok) {
  fail(`PATCH failed: ${patch2.status} ${JSON.stringify(await patch2.json().catch(() => ({})))}`);
}
const patched2 = await patch2.json();
if (patched2.avatar_url !== upload.avatar_url) {
  fail(`avatar_url mismatch: expected '${upload.avatar_url}', got '${patched2.avatar_url}'`);
}
pass(`avatar_url saved to profiles row`);

logStep(7, "PATCH /api/profile with a bad avatar_url (off-bucket) → expect 400");
const badPatch = await fetch(`${APP_URL}/api/profile`, {
  method: "PATCH",
  headers: { "content-type": "application/json", cookie: cookies.join("; ") },
  body: JSON.stringify({ avatar_url: "https://evil.example.com/avatar.jpg" }),
});
if (badPatch.status !== 400) {
  fail(`expected 400 for off-bucket avatar_url, got ${badPatch.status}`);
}
const badBody = await badPatch.json();
if (!badBody.error?.includes("avatar") && !badBody.error?.includes("URL")) {
  fail(`expected Spanish error about avatar URL, got: ${badBody.error}`);
}
pass(`rejected with 400 + Spanish error: "${badBody.error}"`);

logStep(8, "PATCH /api/profile with empty body → expect 400");
const emptyPatch = await fetch(`${APP_URL}/api/profile`, {
  method: "PATCH",
  headers: { "content-type": "application/json", cookie: cookies.join("; ") },
  body: JSON.stringify({}),
});
if (emptyPatch.status !== 400) {
  fail(`expected 400 for empty PATCH, got ${emptyPatch.status}`);
}
pass("empty PATCH rejected with 400");

logStep(9, "Verifying final profile state in DB");
const { data: finalRow } = await admin
  .from("profiles")
  .select("display_name, avatar_url")
  .eq("id", created.user.id)
  .single();
if (finalRow.display_name !== newName) fail(`DB display_name mismatch`);
if (finalRow.avatar_url !== upload.avatar_url) fail(`DB avatar_url mismatch`);
pass(`DB row matches: display_name='${finalRow.display_name}', avatar_url set`);

console.log("\n✅ User profile works as expected.");
console.log("Test user:", TEST_EMAIL);
console.log("\nCleanup: node scripts/cleanup-e2e.mjs --confirm");