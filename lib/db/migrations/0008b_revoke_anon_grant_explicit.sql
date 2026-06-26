-- BoketePR migration 0008b: explicit REVOKE FROM anon for find_nearby_reports.
--
-- Why this exists:
--   Migration 0008 ran with `REVOKE ... FROM public` followed by
--   `GRANT ... TO authenticated`. Verification script
--   `scripts/verify-security-migrations.mjs` showed anon STILL has
--   EXECUTE on the function — the bound-check error fired for an
--   invalid radius call, proving the new function body is active but
--   the access control didn't tighten.
--
-- Postgres ACL gotcha: `public` is a pseudo-role that includes both
-- `anon` and `authenticated`. When migration 0005/0006 ran
--   GRANT EXECUTE ... TO anon, authenticated
-- those were *explicit* grants to named roles, not to `public`.
-- `REVOKE FROM public` only undoes the implicit public grant — the
-- explicit grants to `anon` and `authenticated` survive it.
-- You need `REVOKE ... FROM anon` to actually remove anon.
--
-- Run this in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- Idempotent: re-running is a no-op (REVOKE IF GRANTED, then GRANT).

-- 1. Strip both explicit grants, so we're back to a known state.
revoke execute on function public.find_nearby_reports(
  double precision, double precision, double precision, integer
) from anon;
revoke execute on function public.find_nearby_reports(
  double precision, double precision, double precision, integer
) from authenticated;

-- 2. Re-grant only to authenticated. This is the intended state from
--    migration 0008: anonymous callers should get a permission error,
--    authenticated callers (via /submit, which middleware gates
--    behind auth) get to use it.
grant execute on function public.find_nearby_reports(
  double precision, double precision, double precision, integer
) to authenticated;

-- 3. Sanity check: this query should show exactly 1 row (authenticated).
--    If it shows 2 (anon + authenticated), the revoke didn't take.
select
  grantee,
  privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name = 'find_nearby_reports'
order by grantee;