-- Migration 0007 — add `fixed_at` to reports.
--
-- Goal: keep "fixed" pins visible on the map as green checks for 30 days
-- after they're marked as repaired, instead of vanishing immediately.
-- After 30 days they fall off the map (query filter, not deletion).
--
-- Before this migration:
--   - The /api/reports/[id]/fix route flips status to 'fixed' but doesn't
--     record when.
--   - The /map page fetches WHERE status = 'active' only.
--   - The Realtime UPDATE handler drops the pin when status flips to fixed.
--
-- After:
--   - fixed_at timestamptz NULL when status != 'fixed', set when status flips.
--   - Initial fetch includes recently-fixed rows.
--   - Realtime UPDATE handler keeps the row (renders it as fixed).
--   - Query filter excludes fixed rows older than 30 days.

ALTER TABLE public.reports
  ADD COLUMN fixed_at timestamptz NULL;

-- Backfill: any existing 'fixed' row should have fixed_at = updated_at
-- (best estimate of when it was fixed). Rows with NULL updated_at (shouldn't
-- exist) get the epoch. This makes the 30-day window work for legacy data
-- without keeping decade-old pins on the map.
UPDATE public.reports
  SET fixed_at = COALESCE(updated_at, created_at, '1970-01-01T00:00:00Z')
  WHERE status = 'fixed' AND fixed_at IS NULL;

-- Index: the /map initial fetch uses
--   WHERE status = 'active'
--      OR fixed_at > now() - interval '30 days'
-- (PostgREST .or() shape: `status.eq.active,fixed_at.gt.<iso>`).
-- The OR short-circuits on the existing status index when applicable, but
-- the second branch benefits from this index for fixed-recent queries.
CREATE INDEX reports_fixed_at_idx
  ON public.reports (fixed_at DESC)
  WHERE status = 'fixed';