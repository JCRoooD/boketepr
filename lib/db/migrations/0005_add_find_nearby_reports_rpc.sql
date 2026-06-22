-- BoketePR migration 0005: find_nearby_reports() RPC for duplicate detection
-- Run this in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- Why:
--   The /submit form now warns users when there are existing reports near
--   the location they picked, so they can either confirm an existing one
--   instead of creating a duplicate, or decide their hoyo is genuinely
--   different and submit anyway.
--
--   Radius defaults to 50 m — tight enough that two reports at this
--   distance almost certainly describe the same physical hoyo (a pothole
--   is 0.5–2 m wide, GPS drift on mobile is ~10–15 m, on desktop/WiFi up
--   to ~50 m). The form sends a different radius if it wants to.
--
--   We use PostGIS `ST_DWithin` on the `geography(point, 4326)` column,
--   which uses the existing GiST index `reports_location_gist` (created
--   in migration 0001) — no schema change required.
--
-- Idempotent: re-running is a no-op (CREATE OR REPLACE).

-- =====================================================================
-- 1. The RPC
-- =====================================================================
--
-- `security invoker` is the default but stated explicitly: the caller's
-- RLS applies. The `reports_read_all` policy lets everyone read active
-- rows, so anon + authenticated both work.
--
-- `stable` so the planner knows it doesn't mutate data and can cache
-- planning decisions across calls with the same args.
--
-- `set search_path = public, postgis` so the function's PostGIS calls
-- resolve regardless of the caller's search_path (best practice for any
-- SECURITY-defining or RPC function that touches PostGIS).
-- =====================================================================

create or replace function public.find_nearby_reports(
  lat double precision,
  lng double precision,
  radius_m double precision default 50,
  max_results integer default 5
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
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
    ) as distance_m
  from public.reports r
  where r.status = 'active'
    and ST_DWithin(
      r.location,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
      radius_m
    )
  order by ST_Distance(
    r.location,
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
  )
  limit greatest(max_results, 1);
$$;

-- =====================================================================
-- 2. Grants
-- =====================================================================
-- RLS on `reports` already lets anon read active rows. Granting EXECUTE
-- to anon + authenticated lets the browser-side Supabase client call
-- the RPC without needing a server round-trip.
-- =====================================================================

revoke all on function public.find_nearby_reports(double precision, double precision, double precision, integer) from public;

grant execute on function public.find_nearby_reports(double precision, double precision, double precision, integer)
  to anon, authenticated;