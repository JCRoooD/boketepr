-- BoketePR migration 0008: harden find_nearby_reports RPC.
-- Run this in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- Why:
--   The security audit (SEC-010) flagged two issues with the existing
--   find_nearby_reports RPC (created in 0005, param-renamed in 0006):
--
--     1. `grant execute to anon` — the only browser-side caller is
--        /submit (which middleware gates behind auth). The anon grant
--        was unnecessary and gives an unauthenticated attacker a free
--        PostGIS query endpoint.
--
--     2. No bounds on `in_radius_m` / `in_max_results` — a caller can
--        ask for radius=1e9 m, max_results=1e9, forcing a full-table
--        scan + large result set even if the inner query is indexed.
--
-- Fix:
--   - Drop anon grant; keep authenticated only.
--   - Add CHECK constraints inside the function body (safer than in
--     the signature, since CREATE OR REPLACE can't modify CHECKs on
--     existing params).
--
-- Idempotent: re-running is a no-op (DROP IF EXISTS + CREATE OR REPLACE).

-- =====================================================================
-- 0. Drop the existing function so we can re-grant cleanly.
-- =====================================================================
drop function if exists public.find_nearby_reports(
  double precision, double precision, double precision, integer
);

-- =====================================================================
-- 1. The RPC — same shape, with input validation
-- =====================================================================
--
-- security invoker is still the default (and explicit): caller's RLS
-- applies. The reports_read_all policy lets authenticated callers read
-- active rows; fixed/disputed rows are filtered by the WHERE clause.
--
-- Bound checks (reject anything that looks like a scan attempt):
--   - in_radius_m: must be > 0 and <= 5000 m (5 km, plenty for any
--     "duplicate within walking distance" use case).
--   - in_max_results: must be >= 1 and <= 25 (the only call site
--     caps at 5; 25 leaves room for future UI).
--
create or replace function public.find_nearby_reports(
  in_lat double precision,
  in_lng double precision,
  in_radius_m double precision default 50,
  in_max_results integer default 5
)
returns table (
  id uuid,
  lat double precision,
  lng double precision,
  severity numeric,
  severity_reason text,
  hazards text[],
  user_comment text,
  created_at timestamptz,
  photo_url text,
  thumbnail_url text,
  distance_m double precision
)
language plpgsql   -- plpgsql so we can RAISE EXCEPTION on bad input
stable
security invoker
set search_path = public, postgis
as $$
begin
  if in_lat is null or in_lng is null then
    raise exception 'find_nearby_reports: lat and lng are required';
  end if;
  if in_radius_m is null or in_radius_m <= 0 or in_radius_m > 5000 then
    raise exception 'find_nearby_reports: in_radius_m must be in (0, 5000] meters';
  end if;
  if in_max_results is null or in_max_results < 1 or in_max_results > 25 then
    raise exception 'find_nearby_reports: in_max_results must be in [1, 25]';
  end if;

  return query
  select
    r.id,
    r.lat,
    r.lng,
    r.severity,
    r.severity_reason,
    r.hazards,
    r.user_comment,
    r.created_at,
    r.photo_url,
    r.thumbnail_url,
    ST_Distance(
      r.location,
      ST_SetSRID(ST_MakePoint(in_lng, in_lat), 4326)::geography
    ) as distance_m
  from public.reports r
  where r.status = 'active'
    and ST_DWithin(
      r.location,
      ST_SetSRID(ST_MakePoint(in_lng, in_lat), 4326)::geography,
      in_radius_m
    )
  order by ST_Distance(
    r.location,
    ST_SetSRID(ST_MakePoint(in_lng, in_lat), 4326)::geography
  )
  limit in_max_results;
end;
$$;

-- =====================================================================
-- 2. Grants — authenticated only.
-- =====================================================================
-- The only caller is the /submit page, which middleware redirects anon
-- visitors away from (PROTECTED_PREFIXES includes /submit). So the
-- anonymous grant was unnecessary. Removing it stops anonymous
-- PostGIS-query probing (SEC-010).
--
-- IMPORTANT (Postgres ACL gotcha): migration 0005/0006 explicitly
-- granted EXECUTE to `anon` and `authenticated` — those are NAMED
-- role grants, not implicit-public grants. `REVOKE FROM public`
-- alone would only undo the implicit public pseudo-grant; the
-- explicit grants to anon/authenticated survive it. So we must
-- REVOKE FROM anon + REVOKE FROM authenticated explicitly, then
-- re-GRANT only to authenticated. (See migration 0008b for the
-- corrective that fixed the partial application of 0008.)
-- =====================================================================
revoke all on function public.find_nearby_reports(double precision, double precision, double precision, integer) from public;
revoke execute on function public.find_nearby_reports(double precision, double precision, double precision, integer) from anon;
revoke execute on function public.find_nearby_reports(double precision, double precision, double precision, integer) from authenticated;

grant execute on function public.find_nearby_reports(double precision, double precision, double precision, integer)
  to authenticated;