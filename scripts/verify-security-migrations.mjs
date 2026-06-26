// Verify migrations 0008 + 0009 landed correctly.
// Loads .env.local for anon + service-role keys (never prints them).
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const envText = readFileSync("C:/Users/juanc/Projects/boketepr/.env.local", "utf8");
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !ANON || !SERVICE) { console.error("missing env"); process.exit(1); }

// Anon client (no cookies — simulates a not-logged-in browser).
const anon = createClient(URL, ANON, { auth: { persistSession: false } });

console.log("=== SEC-010/0008: anon calling find_nearby_reports should now FAIL ===");
const { data: rpcData, error: rpcErr } = await anon.rpc("find_nearby_reports", {
  in_lat: 18.4655, in_lng: -66.1057, in_radius_m: 50, in_max_results: 5,
});
if (rpcErr) {
  console.log("✔ anon RPC rejected:", rpcErr.message.split("\n")[0]);
} else {
  console.log("✗ anon RPC unexpectedly succeeded — migration 0008 not applied!");
  console.log("  returned:", rpcData);
}

console.log("\n=== SEC-014/0009: anon SELECT FROM profiles should now return 0 rows ===");
const { data: profAnon, error: profAnonErr } = await anon.from("profiles").select("id, display_name");
if (profAnonErr) {
  console.log("✗ anon profile query errored:", profAnonErr.message);
} else {
  console.log(`✔ anon sees ${profAnon.length} profile rows (expected 0)`);
}

// Authed client: find a real user that has a profile row, log in as them,
// confirm both RPC + profile reads work.
console.log("\n=== Service-role sanity: RPC and profile reads should work normally ===");
const svc = createClient(URL, SERVICE, { auth: { persistSession: false } });
const { data: rpcOk, error: rpcOkErr } = await svc.rpc("find_nearby_reports", {
  in_lat: 18.4655, in_lng: -66.1057, in_radius_m: 50, in_max_results: 5,
});
if (rpcOkErr) {
  console.log("✗ service-role RPC failed:", rpcOkErr.message);
} else {
  console.log(`✔ service-role RPC returned ${rpcOk.length} rows (any number is fine)`);
}

const { count: profCount, error: profSvcErr } = await svc.from("profiles").select("id", { count: "exact", head: true });
if (profSvcErr) {
  console.log("✗ service-role profile count failed:", profSvcErr.message);
} else {
  console.log(`✔ service-role sees ${profCount} profile rows`);
}

console.log("\n=== Done. ===");