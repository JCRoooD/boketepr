-- =====================================================================
-- 0003 — Add ai_scored_at to reports
-- =====================================================================
--
-- Context:
--   Goal 4 wires up OpenAI gpt-4o-mini to score each report's photo
--   and update `severity` / `severity_reason` / `hazards`. The model
--   version is already tracked in `ai_model_version` (added in 0001),
--   but we have no "when was this scored?" column.
--
--   We add `ai_scored_at` so we can:
--     - Tell fresh reports from stale ones (real-time map can prioritize)
--     - Re-score old reports in bulk when the model is upgraded
--     - Debug scoring failures (NULL means scoring never finished)
--
-- Failure mode: a row with severity=5.0 and ai_scored_at=NULL is a
-- "still placeholder" report. The /api/reports route falls back to the
-- placeholder when the OpenAI call fails, so this distinction matters.
--
-- Purely additive — no impact on existing data, no constraint changes.

alter table public.reports
  add column if not exists ai_scored_at timestamptz;

-- Index for the "stale, needs re-score" query we'd run when upgrading
-- the AI model. Partial: only NULLs, which are the interesting ones.
create index if not exists reports_ai_scored_at_null_idx
  on public.reports (created_at desc)
  where ai_scored_at is null;
