-- BoketePR migration 0006: rename find_nearby_reports input params to break
-- the RETURNS TABLE parameter shadow that broke migration 0005.
--
-- Run this in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- Why:
--   Migration 0005 declared the function as:
--
--     create function public.find_nearby_reports(
--       lat double precision,
--       lng double precision,
--       radius_m double precision default 50,
--       max_results integer default 5
--     )
--     returns table (
--       ...
--       lat double precision,
--       lng double precision,
--       ...
--       distance_m double precision
--     )
--
--   The OUT columns `lat` and `lng` shadow the IN parameters of the same
--   name inside the function body. So inside the SELECT, `lat` and `lng`
--   referred to the (NULL at filter-time) output columns, not the user's
--   input. ST_MakePoint(NULL, NULL) produced a point at (0,0) which:
--
--     - ST_DWithin evaluated incorrectly (treated every row as either
--       inside or outside depending on PostGIS version specifics, but
--       never correctly per the user's radius), and
--     - ST_Distance returned 0 (because the OUT column `distance_m` was
--       being assigned a constant, or the OUT column itself shadowed
--       something it shouldn't have).
--
--   Smoke test confirmed: the broken function returned the only row in
--   the table with `distance_m = 0` regardless of the user's query
--   point or radius. Real-world impact: the duplicate-detection card on
--   /submit would show wrong matches at wrong distances.
--
-- Fix:
--   Rename the IN parameters to `in_lat`, `in_lng`, `in_radius_m`,
--   `in_max_results`. The OUT columns (`lat`, `lng`, `distance_m`, ...)
--   keep their names so the API response shape is unchanged.
--
--   The RPC's call-site in lib/reports/queries.ts must send the new
--   param names. Type definitions in lib/supabase/types.ts updated to
--   match.
--
-- Idempotent: re-running is a no-op (CREATE OR REPLACE).

-- =====================================================================
-- 1. The fixed RPC
-- =====================================================================

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
language sql
stable
security invoker
set search_path = public, postgis
as $$
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
  limit greatest(in_max_results, 1);
$$;

-- =====================================================================
-- 2. Grants (same as migration 0005)
-- =====================================================================

revoke all on function public.find_nearby_reports(double precision, double precision, double precision, integer) from public;

grant execute on function public.find_nearby_reports(double precision, double precision, double precision, integer)
  to anon, authenticated;