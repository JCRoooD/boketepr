// Disambiguator for SEC-010 / migration 0008.
// Two tests:
//   A. Call with VALID params — if anon has no EXECUTE, we expect a permission error.
//      If anon has EXECUTE, the function runs and returns [] (DB has no reports).
//   B. Call with INVALID (radius=99999) — if anon has EXECUTE, the function's
//      bound check fires and returns the explicit error message
//      "find_nearby_reports: in_radius_m must be in (0, 5000] meters".
//      If anon has NO EXECUTE, we get a permission error.
//
// A "permission denied" in both = migration worked, PostgREST cache may be stale.
// An "in_radius_m" error in B = anon still has EXECUTE — migration 0008 was incomplete.
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
const anon = createClient(URL, ANON, { auth: { persistSession: false } });
const svc  = createClient(URL, SERVICE, { auth: { persistSession: false } });

console.log("=== A) anon RPC with VALID params (radius=50) ===");
const a = await anon.rpc("find_nearby_reports", {
  in_lat: 18.4655, in_lng: -66.1057, in_radius_m: 50, in_max_results: 5,
});
console.log("  error:", a.error?.message ?? "(none)");
console.log("  data :", a.data);

console.log("\n=== B) anon RPC with INVALID params (radius=99999) ===");
const b = await anon.rpc("find_nearby_reports", {
  in_lat: 18.4655, in_lng: -66.1057, in_radius_m: 99999, in_max_results: 5,
});
console.log("  error:", b.error?.message ?? "(none)");
console.log("  data :", b.data);

console.log("\n=== C) service-role sanity ===");
const c = await svc.rpc("find_nearby_reports", {
  in_lat: 18.4655, in_lng: -66.1057, in_radius_m: 99999, in_max_results: 5,
});
console.log("  error:", c.error?.message ?? "(none)");

console.log("\n=== Diagnosis ===");
const A_is_perm = a.error?.message?.toLowerCase().includes("permission") || a.error?.code === "42501";
const B_is_bound = b.error?.message?.includes("in_radius_m must be");
const C_is_bound = c.error?.message?.includes("in_radius_m must be");

console.log("  A permission error? ", A_is_perm);
console.log("  B bound-check error?", B_is_bound);
console.log("  C bound-check error (expected true)?", C_is_bound);

if (B_is_bound) {
  console.log("\n  >>> anon STILL has EXECUTE on the function. Migration 0008 incomplete — needs an explicit `revoke execute on function ... from anon;`");
} else if (A_is_perm) {
  console.log("\n  >>> anon has NO EXECUTE — migration 0008 worked. The empty result in the previous test was PostgREST schema-cache lag.");
} else {
  console.log("\n  >>> unclear — share output with the assistant");
}