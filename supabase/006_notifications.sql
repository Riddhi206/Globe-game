-- 006_notifications.sql — realtime friend notifications + a cheap Daily
-- player count for promoting the leaderboard. Run after 004_friends.sql.
-- Safe to re-run.

-- ============================================================
-- Let a player's own browser subscribe (via Supabase Realtime) to rows
-- that are about them — a new request, or a request turning into a
-- friendship. Scoped narrowly: never another player's requests.
-- ============================================================
drop policy if exists "read my friend requests" on public.friend_requests;
create policy "read my friend requests" on public.friend_requests
  for select to authenticated using (to_id = auth.uid() or from_id = auth.uid());

drop policy if exists "read my friendships" on public.friendships;
create policy "read my friendships" on public.friendships
  for select to authenticated using (user_id = auth.uid());

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'friend_requests') then
    alter publication supabase_realtime add table public.friend_requests;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'friendships') then
    alter publication supabase_realtime add table public.friendships;
  end if;
end $$;

-- ============================================================
-- How many named players have a score for a Daily — cheap enough to
-- show on the home screen and Daily card without computing full ranks.
-- ============================================================
create or replace function public.daily_player_count(p_day date default (now() at time zone 'utc')::date)
returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int
  from public.daily_scores s
  join public.profiles p on p.id = s.user_id
  where s.day = p_day and p.username is not null;
$$;

revoke all on function public.daily_player_count(date) from public, anon;
grant execute on function public.daily_player_count(date) to authenticated;
