-- BoketePR initial database schema
-- Run this in: Supabase Dashboard → SQL Editor → New query → paste → Run
-- Or via supabase CLI: `supabase db push` (after `supabase link --project-ref <ref>`)

-- =====================================================================
-- 1. Extensions
-- =====================================================================

create extension if not exists postgis;
create extension if not exists pgcrypto;   -- for gen_random_uuid()

-- =====================================================================
-- 2. Tables
-- =====================================================================

-- Public user profile, 1:1 with auth.users
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  reports_submitted int not null default 0 check (reports_submitted >= 0),
  -- reserved for future moderation:
  is_banned boolean not null default false
);

-- Reports table with PostGIS point + 6-char geohash
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  location geography(point, 4326) not null,
  geohash text not null,
  photo_url text not null,
  thumbnail_url text,
  severity numeric(3,1) not null check (severity between 1.0 and 10.0),
  severity_reason text not null,
  hazards text[] not null default '{}',
  user_comment text,
  status text not null default 'active'
    check (status in ('active', 'fixed', 'disputed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ai_model_version text,
  -- reserved for v2 community features:
  confirm_count int not null default 0 check (confirm_count >= 0),
  dispute_count int not null default 0 check (dispute_count >= 0),
  submitted_to_dtop boolean not null default false
);

-- =====================================================================
-- 3. Indexes
-- =====================================================================

-- Geohash for fast bbox filtering (1 grid cell ≈ 1.2km × 0.6km at PR latitudes)
create index reports_geohash_idx on public.reports (geohash);

-- GiST index on geography column — required for ST_DWithin / ST_Distance queries
create index reports_location_gist on public.reports using gist (location);

-- Btree for chronological listing
create index reports_created_at_idx on public.reports (created_at desc);

-- Partial index for "most severe active reports" query (used by map default)
create index reports_severity_active_idx on public.reports (severity desc)
  where status = 'active';

create index reports_user_id_idx on public.reports (user_id);

-- =====================================================================
-- 4. Row Level Security
-- =====================================================================

-- profiles: everyone can read, only owner can update, only the auth system inserts
alter table public.profiles enable row level security;

create policy "profiles_read_all"
  on public.profiles for select
  using (true);

create policy "profiles_update_self"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- profiles rows are created automatically by the trigger below (SECURITY DEFINER),
-- so we don't add an insert policy — direct inserts from the client are blocked.

-- reports: everyone reads, authenticated users insert as themselves, owner updates/deletes
alter table public.reports enable row level security;

create policy "reports_read_all"
  on public.reports for select
  using (true);

create policy "reports_insert_authed"
  on public.reports for insert
  with check (auth.uid() = user_id);

create policy "reports_update_owner"
  on public.reports for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "reports_delete_owner"
  on public.reports for delete
  using (auth.uid() = user_id);

-- The /api/score endpoint uses the service_role key to update the row
-- (sets severity after the AI scores the photo), bypassing these policies.

-- =====================================================================
-- 5. Triggers
-- =====================================================================

-- Auto-create a profile row when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Auto-update updated_at on row UPDATE for both tables
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger reports_set_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();

-- Bump profiles.reports_submitted when a new report is inserted
create or replace function public.bump_reports_submitted()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.user_id is not null then
    update public.profiles
      set reports_submitted = reports_submitted + 1
      where id = new.user_id;
  end if;
  return new;
end;
$$;

create trigger reports_bump_counter
  after insert on public.reports
  for each row execute function public.bump_reports_submitted();

-- =====================================================================
-- 6. Realtime
-- =====================================================================

-- Enable realtime for the reports table (used by the public map)
alter publication supabase_realtime add table public.reports;

-- =====================================================================
-- 7. Storage buckets
-- =====================================================================

-- Photos: original uploads, public read, authed write
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos', 'photos', true,
  10485760,  -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

-- Thumbnails: server-generated, public read, server-side write only
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'thumbnails', 'thumbnails', true,
  2097152,  -- 2 MB
  array['image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

-- Avatars: profile pictures, public read, owner write
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars', 'avatars', true,
  2097152,  -- 2 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Storage RLS: anyone can read, authed users can upload to a path matching their user_id
create policy "photos_read_all"
  on storage.objects for select
  using (bucket_id in ('photos', 'thumbnails', 'avatars'));

create policy "photos_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars_update_own"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- thumbnails are written server-side only via service_role key (bypasses RLS)
