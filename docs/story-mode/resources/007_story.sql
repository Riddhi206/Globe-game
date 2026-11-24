-- 007_story.sql — story mode: the ending choice split, and story progress
-- synced across a player's devices. Run after 006_notifications.sql.
-- Copy to supabase/007_story.sql (04-build-plan.md, M9). Safe to re-run.

-- ============================================================
-- The ending choice. One row per player, first choice only — replaying
-- chapter 7 can change the ending you see, but not the global count.
-- ============================================================
create table if not exists public.story_choices (
  user_id    uuid primary key default auth.uid() references auth.users on delete cascade,
  story      text not null default 'unmaking' check (story ~ '^[a-z_]{2,40}$'),
  choice     text not null check (choice in ('break', 'keep')),
  created_at timestamptz not null default now()
);
alter table public.story_choices enable row level security;   -- no policies: functions only

create or replace function public.submit_story_choice(p_choice text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_choice not in ('break', 'keep') then raise exception 'bad choice'; end if;
  insert into public.story_choices (user_id, choice) values (auth.uid(), p_choice)
  on conflict (user_id) do nothing;
end $$;

-- { break, keep } counts — the client turns them into "58% chose this"
create or replace function public.story_choice_stats()
returns table (break_count bigint, keep_count bigint)
language sql stable security definer set search_path = '' as $$
  select count(*) filter (where choice = 'break'),
         count(*) filter (where choice = 'keep')
  from public.story_choices;
$$;

revoke all on function public.submit_story_choice(text) from public, anon;
revoke all on function public.story_choice_stats()      from public, anon;
grant execute on function public.submit_story_choice(text) to authenticated;
grant execute on function public.story_choice_stats()      to authenticated;

-- ============================================================
-- Story progress: the whole local progress object as JSON, one row per
-- player. The client merges per chapter (best World saved wins, a 'done'
-- chapter never goes back to 'available'), so last-write-wins here is fine.
-- ============================================================
create table if not exists public.story_progress (
  user_id    uuid primary key default auth.uid() references auth.users on delete cascade,
  progress   jsonb not null check (pg_column_size(progress) <= 20000),
  updated_at timestamptz not null default now()
);
alter table public.story_progress enable row level security;

drop policy if exists "read own story" on public.story_progress;
create policy "read own story" on public.story_progress
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "insert own story" on public.story_progress;
create policy "insert own story" on public.story_progress
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "update own story" on public.story_progress;
create policy "update own story" on public.story_progress
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
