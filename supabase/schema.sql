-- schema.sql — Pancake database (Supabase / Postgres).
-- Run once in Supabase → SQL Editor. Safe to re-run.
--
-- Every visitor gets an anonymous auth user on first load; signing in with
-- Google links that identity to the same user, so nothing is lost.

-- ============================================================
-- Profiles — one row per auth user (anonymous ones too)
-- ============================================================
create table if not exists public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  username   text unique check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Create the profile automatically when an auth user is created
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Games — mirrors a game record in store.js.
-- `id` is generated on the device, so the key is (user_id, id): the same
-- local game can be uploaded again under a different account.
-- ============================================================
create table if not exists public.games (
  user_id        uuid not null default auth.uid() references auth.users on delete cascade,
  id             uuid not null,
  mode           text not null check (mode in ('daily', 'classic', 'endless')),
  day            date not null,
  mystery        text not null,
  won            boolean not null,
  guess_count    int  not null check (guess_count between 1 and 300),
  temps          text[] not null default '{}',
  score          int  not null check (score >= 0),
  trivia_correct int  not null default 0 check (trivia_correct >= 0),
  first_guess    text,
  played_at      timestamptz not null,
  created_at     timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists games_daily_idx on public.games (day, score desc) where mode = 'daily';

alter table public.games enable row level security;

drop policy if exists "read own games" on public.games;
create policy "read own games" on public.games
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "insert own games" on public.games;
create policy "insert own games" on public.games
  for insert to authenticated with check (user_id = (select auth.uid()));

-- No update/delete policies: a finished game can't be edited from the client.
-- Scores are still client-reported; Daily scores will be validated server-side
-- (edge function) before the public leaderboard goes live.
