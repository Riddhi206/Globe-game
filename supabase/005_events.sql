-- 005_events.sql — product events (what players do besides finishing games).
-- Run after schema.sql. Safe to re-run.
--
-- Write-only from the app: players can insert their own events but never
-- read any back. Read them in the SQL editor (see queries/insights.sql).
-- No personal data: a random user id, coarse device info, and event details.

create table if not exists public.events (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  session_id  uuid not null,                      -- one per page load
  name        text not null check (name ~ '^[a-z_]{2,40}$'),
  props       jsonb not null default '{}'::jsonb check (pg_column_size(props) <= 2000),
  context     jsonb not null default '{}'::jsonb check (pg_column_size(context) <= 1000),
  created_at  timestamptz not null default now()
);

create index if not exists events_name_time_idx on public.events (name, created_at);
create index if not exists events_user_time_idx on public.events (user_id, created_at);

alter table public.events enable row level security;

drop policy if exists "insert own events" on public.events;
create policy "insert own events" on public.events
  for insert to authenticated with check (user_id = (select auth.uid()));
