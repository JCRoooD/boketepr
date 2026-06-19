-- BoketePR migration 0004: add exact lat/lng columns to reports
-- Run this in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- Why:
--   The reports table stores a PostGIS `location geography(point, 4326)`
--   column (exact) AND a 6-character `geohash` column (~1.2 km grid).
--   The map was reading from the geohash and decoding it back to a
--   point, which is the cell's center — so pins landed up to ~600 m
--   from where the user actually was. This migration adds raw `lat` /
--   `lng` columns backfilled from PostGIS, so the map can drop pins
--   on the exact point the user submitted.
--
--   The PostGIS `location` column stays (used for the GiST index +
--   ST_DWithin radius queries). The `geohash` column stays (used for
--   the cell-based neighbor index).
--
-- Idempotent: re-running is a no-op after the first successful run.

-- =====================================================================
-- 1. Add nullable lat/lng columns
--    Nullable so the ALTER doesn't fail on existing rows before the
--    backfill.
-- =====================================================================

alter table public.reports
  add column if not exists lat double precision,
  add column if not exists lng double precision;

-- =====================================================================
-- 2. Backfill from PostGIS
--    PostGIS geography(point, 4326) is stored as POINT(lng lat), so:
--      X (longitude) → lng
--      Y (latitude)  → lat
--    Cast to ::geometry first — some ST_X/ST_Y overloads behave
--    differently on geography, and ::geometry is the safe path.
-- =====================================================================

update public.reports
set
  lat = ST_Y(location::geometry),
  lng = ST_X(location::geometry)
where lat is null or lng is null;

-- =====================================================================
-- 3. Lock to NOT NULL
--    Only safe after the backfill. If this ALTER fails, it means some
--    rows have NULL lat/lng — run the UPDATE above again and check
--    for rows where location is NULL.
-- =====================================================================

alter table public.reports
  alter column lat set not null,
  alter column lng set not null;

-- =====================================================================
-- 4. Sanity-check constraint
--    Valid range for any lat/lng. PR is enforced at the API layer in
--    lib/geo/pr-bbox.ts; this is just a last-resort guard.
-- =====================================================================

alter table public.reports
  drop constraint if exists reports_lat_lng_range_check;

alter table public.reports
  add constraint reports_lat_lng_range_check
  check (lat between -90 and 90 and lng between -180 and 180);

-- =====================================================================
-- 5. Trigger: keep lat/lng in sync with location
--    If any code path inserts or updates the `location` column without
--    also setting lat/lng, the trigger re-derives them from PostGIS so
--    they can never drift.
-- =====================================================================

create or replace function public.reports_sync_lat_lng()
returns trigger
language plpgsql
as $$
begin
  if new.location is not null then
    new.lat := ST_Y(new.location::geometry);
    new.lng := ST_X(new.location::geometry);
  end if;
  return new;
end;
$$;

drop trigger if exists reports_sync_lat_lng on public.reports;
create trigger reports_sync_lat_lng
  before insert or update on public.reports
  for each row execute function public.reports_sync_lat_lng();

-- =====================================================================
-- 6. Btree index on (lat, lng) for future bbox queries
--    The current map doesn't need this (it only fetches by created_at
--    and decodes point in JS), but it's cheap to add and lets us drop
--    PostGIS later if we ever want to.
-- =====================================================================

create index if not exists reports_lat_lng_idx
  on public.reports (lat, lng);
