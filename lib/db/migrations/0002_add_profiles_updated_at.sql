-- =====================================================================
-- 0002 — Add updated_at to profiles
-- =====================================================================
--
-- Context:
--   The profiles table is missing an `updated_at` column, but it has a
--   `profiles_set_updated_at` trigger that runs on UPDATE and does:
--
--       new.updated_at = now()
--
--   This trigger has been latent (never fired) because nothing in v0.x
--   ever UPDATEd a profile row.
--
--   The bump_reports_submitted() trigger (after insert on public.reports)
--   does an UPDATE on public.profiles, which fires the broken
--   profiles_set_updated_at trigger, which errors with:
--
--       record "new" has no field "updated_at"
--
--   This blocks every report insert with a 500.
--
-- Fix:
--   Add the column the trigger expects. The default fills existing rows
--   with now() at migration time.
--
-- This is a pure additive change — no data loss, no impact on the
-- profiles_select / profiles_update_self RLS policies (those don't
-- reference updated_at).

alter table public.profiles
  add column if not exists updated_at timestamptz not null default now();

-- Sanity check: the fix should make the trigger chain work. We don't
-- run a full insert here (that would create a fake report). Instead,
-- just confirm the column exists and the trigger is in place.
do $$
declare
  has_col boolean;
  has_trg boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'updated_at'
  ) into has_col;

  select exists (
    select 1 from pg_trigger
    where tgname = 'profiles_set_updated_at'
  ) into has_trg;

  if not has_col then
    raise exception 'Migration verification failed: profiles.updated_at still missing';
  end if;
  if not has_trg then
    raise exception 'Migration verification failed: profiles_set_updated_at trigger missing';
  end if;

  raise notice 'OK: profiles.updated_at exists and profiles_set_updated_at trigger is in place';
end
$$;
