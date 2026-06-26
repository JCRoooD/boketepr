-- BoketePR migration 0009: restrict profiles_read_all to authenticated users.
-- Run this in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- Why:
--   The security audit (SEC-014) flagged that `profiles_read_all` lets
--   anonymous viewers enumerate every user_id (= auth.users.id) by
--   reading profile rows. The id column is the primary key and is
--   implicitly selectable in many queries.
--
--   This is a privacy / stalking vector: combined with the public
--   avatar URLs (which contain the user's UUID in the storage path),
--   an attacker can correlate identities across the internet and
--   target specific users.
--
-- Fix:
--   Tighten `profiles_read_all` to require `auth.uid() IS NOT NULL`.
--   This still lets every signed-in user see every other user's
--   profile (needed for the /map pin panel which shows reporter
--   avatars + display names), but stops anon visitors from harvesting
--   the user-id → display-name → avatar mapping.
--
--   IMPORTANT: This does NOT break the /map for anon viewers — they
--   still see all `reports` rows via the separate `reports_read_all`
--   policy. They just can't see the reporter's display_name or
--   avatar_url from `profiles`. The PinDetailPanel will need a
--   graceful fallback when profile data is unavailable to anon
--   viewers (handled in the application code, not here).

drop policy if exists "profiles_read_all" on public.profiles;

create policy "profiles_read_authed"
  on public.profiles for select
  using (auth.uid() is not null);