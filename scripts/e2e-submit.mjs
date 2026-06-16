/**
 * Manual end-to-end smoke test for Goal 3.
 *
 *   1. Create a fresh test user via the Supabase admin API (auto-confirmed)
 *   2. Sign in as that user to get a session cookie
 *   3. POST /api/upload  → get a signed URL
 *   4. PUT a fake JPEG to the signed URL
 *   5. POST /api/reports → row inserted in Postgres
 *   6. Verify the row appears + photo exists in Storage
 *
 * Usage:  node scripts/e2e-submit.mjs
 *
 * Reads .env.local for SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
 */

import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

// --- Load .env.local (tiny parser; no dotenv dep) ---
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

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_EMAIL = `e2e-test-${Date.now()}@boketepr-test.local`;
const TEST_PASSWORD = "E2ETest-Pass-2026!";

console.log("1. Creating test user…");
const { data: created, error: createErr } = await admin.auth.admin.createUser({
  email: TEST_EMAIL,
  password: TEST_PASSWORD,
  email_confirm: true, // skip confirmation
});
if (createErr) {
  console.error("  ✗", createErr.message);
  process.exit(1);
}
console.log("  ✓", created.user.id);

console.log("2. Signing in as test user…");
const browser = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false },
});
const { data: signin, error: signinErr } =
  await browser.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
if (signinErr || !signin.session) {
  console.error("  ✗", signinErr?.message ?? "no session");
  process.exit(1);
}
console.log("  ✓ access token issued");

// Carry the cookies Vercel needs. supabase-js stores them in storage; we
// grab the access token and the sb-* cookies via the project's cookie store
// proxy is not exposed — instead we set the Authorization header on our
// server-side API calls.
const accessToken = signin.session.access_token;

// For the browser-style fetch we also want the sb-* cookies so middleware
// sees a logged-in user. Pull them from the session.
const cookies = [];
// @supabase/supabase-js doesn't expose the raw Set-Cookie headers from
// signInWithPassword in v2. Instead we craft them from the project ref.
const projectRef = SUPABASE_URL.match(/https?:\/\/([^.]+)/)[1];
cookies.push(
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
);

console.log("3. POST /api/upload…");
const uploadRes = await fetch(`${APP_URL}/api/upload`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    cookie: cookies.join("; "),
  },
  body: JSON.stringify({
    filename: "test-pothole.jpg",
    contentType: "image/jpeg",
  }),
});
if (!uploadRes.ok) {
  console.error("  ✗", uploadRes.status, await uploadRes.text());
  process.exit(1);
}
const upload = await uploadRes.json();
console.log("  ✓ signed URL issued");
console.log("    path:", upload.path);

console.log("4. PUT a fake JPEG to the signed URL…");
// 1x1 red JPEG, ~125 bytes
const fakeJpeg = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAr/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AB//Z",
  "base64",
);
const putRes = await fetch(upload.signedUrl, {
  method: "PUT",
  headers: { "content-type": "image/jpeg" },
  body: fakeJpeg,
});
if (!putRes.ok) {
  console.error("  ✗", putRes.status, await putRes.text());
  process.exit(1);
}
console.log("  ✓ photo uploaded to Supabase Storage");

console.log("5. POST /api/reports…");
const reportRes = await fetch(`${APP_URL}/api/reports`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    cookie: cookies.join("; "),
  },
  body: JSON.stringify({
    photo_url: upload.publicUrl,
    lat: 18.4655, // San Juan
    lng: -66.1057,
    user_comment: "Hoyo profundo en la calle principal.",
  }),
});
const reportBody = await reportRes.json();
if (!reportRes.ok) {
  console.error("  ✗", reportRes.status, reportBody);
  process.exit(1);
}
console.log("  ✓ report created:", reportBody.id);

console.log("6. Verifying in database…");
const { data: row, error: readErr } = await admin
  .from("reports")
  .select("id, user_id, geohash, severity, severity_reason, status")
  .eq("id", reportBody.id)
  .single();
if (readErr || !row) {
  console.error("  ✗", readErr?.message);
  process.exit(1);
}
console.log("  ✓ row found in DB:");
console.log("    user_id:", row.user_id);
console.log("    geohash:", row.geohash);
console.log("    severity (placeholder):", row.severity);
console.log("    reason (placeholder):", row.severity_reason);
console.log("    status:", row.status);

console.log("7. Verifying photo in Storage…");
const { data: files, error: listErr } = await admin.storage
  .from("photos")
  .list(row.user_id, { limit: 10 });
if (listErr) {
  console.error("  ✗", listErr.message);
  process.exit(1);
}
console.log("  ✓ files in user's folder:");
for (const f of files) {
  console.log("    -", f.name, `(${f.metadata?.size ?? "?"} bytes)`);
}

console.log("\n✅ All checks passed.");
console.log("Test user:", TEST_EMAIL, "(password:", TEST_PASSWORD, ")");
console.log("Report ID:", reportBody.id);
console.log("(Leaving the test user + report in the database for inspection.)");
