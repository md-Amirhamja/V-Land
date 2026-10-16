-- 001_core.sql  -  V-Land P5 / Build Round 1
-- Paste into Supabase > SQL Editor and run once. Safe to re-run.
-- Order: 001_core.sql -> (create the two demo users in Auth) -> 002_demo_roles.sql -> 003_geo_units_seed.sql

-- ---------- extensions ----------
create extension if not exists postgis  with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm  with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ---------- private schema (never exposed through the API) ----------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------- roles ----------
do $$ begin
  create type public.app_role as enum ('citizen', 'admin');
exception when duplicate_object then null; end $$;

-- ---------- profiles ----------
create table if not exists public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  role              public.app_role not null default 'citizen',
  display_name      text,
  lang              text not null default 'bn' check (lang in ('bn', 'en')),
  linked_person_id  uuid,                       -- Round 2: powers the demo "Owner shield" view
  created_at        timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Every new auth user gets a CITIZEN profile. The role is never read from user-editable metadata.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(split_part(new.email, '@', 1), 'user'))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for users that existed before the trigger.
insert into public.profiles (id, display_name)
select u.id, split_part(u.email, '@', 1) from auth.users u
on conflict (id) do nothing;

-- Admin check. Reads profiles.role only.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin');
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- A signed-in user can read their own profile, and change ONLY display_name and lang.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (display_name, lang) on public.profiles to authenticated;   -- role is NOT in this list
-- (admins change roles through the SQL editor / admin functions in Round 4, never from the browser)
revoke all on public.profiles from anon;

-- ---------- geo hierarchy (Division > District > Upazila "area") ----------
create table if not exists public.geo_units (
  id         bigint generated always as identity primary key,
  level      text not null check (level in ('division', 'district', 'area')),
  parent_id  bigint references public.geo_units(id) on delete restrict,
  name_en    text not null,
  name_bn    text not null,
  glb_key    text not null unique        -- exact node name in the 3D model, e.g. Dhaka__Dhaka__Uttara
);
create index if not exists geo_units_parent_idx on public.geo_units(parent_id);
create index if not exists geo_units_level_idx  on public.geo_units(level);
alter table public.geo_units enable row level security;
-- The hierarchy is public reference data (names only), so everyone may read it.
drop policy if exists geo_units_read on public.geo_units;
create policy geo_units_read on public.geo_units for select to anon, authenticated using (true);
drop policy if exists geo_units_admin_write on public.geo_units;
create policy geo_units_admin_write on public.geo_units for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke insert, update, delete on public.geo_units from anon;

-- ---------- mouzas (revenue villages) ----------
create table if not exists public.mouzas (
  id          bigint generated always as identity primary key,
  upazila_id  bigint not null references public.geo_units(id),
  name_en     text not null,
  name_bn     text not null,
  jl_no       text,
  is_synthetic boolean not null default true
);
create index if not exists mouzas_upazila_idx on public.mouzas(upazila_id);
alter table public.mouzas enable row level security;
-- No public or citizen policy: land data is reached only through functions (Round 2).
drop policy if exists mouzas_admin_all on public.mouzas;
create policy mouzas_admin_all on public.mouzas for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.mouzas from anon;

-- ---------- check query ----------
select 'profiles' as tbl, count(*) from public.profiles
union all select 'geo_units', count(*) from public.geo_units;
