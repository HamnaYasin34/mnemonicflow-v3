-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- It is idempotent — safe to re-run.
--
-- Why a database trigger instead of app-side "create profile after signup"
-- code: a trigger runs inside the same transaction as the auth.users insert,
-- so there is no window where a user exists but has no profile row (which is
-- what causes "profile not found" bugs after email confirmation, OAuth
-- signups, or users created from the Supabase dashboard). It's also the
-- officially recommended Supabase pattern for this exact use case.

-- 1. Make sure the table exists with the columns the app expects.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  total_cards integer not null default 0,
  total_reviews integer not null default 0,
  streak_days integer not null default 0,
  created_at timestamptz not null default now()
);

-- 2. Row Level Security: users can only see/edit their own profile.
alter table public.profiles enable row level security;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Intentionally no INSERT/DELETE policy for regular users — profile rows
-- are only ever created by the trigger below (as the postgres superuser),
-- and deleted automatically via the FK's `on delete cascade`.

-- 3. Function + trigger: auto-create a profile row whenever a new user
--    is created in auth.users (covers email/password signup, magic link,
--    and any OAuth providers you add later).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
