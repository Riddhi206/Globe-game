-- 022_classic_leaderboard.sql — a weekly global leaderboard for Classic.
-- Run after 021_scoring.sql. Safe to re-run.
--
-- Everyone gets different random countries in Classic, so single games aren't comparable.
-- Instead: each week (Monday 00:00 UTC to Monday), a player's score is the total of their
-- best 10 Classic finds. Skill and a bit of play count; endless grinding doesn't.
--
-- Points come from the server, never the app: daily_points(guesses, mystery), the same
-- formula as the Daily (found in n = (11 − n) × 100 + aim; Classic has no guess limit,
-- so 10+ guesses all sit in the 100s). Games come from public.games, which the app
-- already syncs; one only counts if its guess list is a real game: distinct guesses,
-- ending on a real country. The week is when the server received the game (created_at),
-- so a device clock can't move games between weeks.

create index if not exists games_classic_week_idx on public.games (created_at) where mode = 'classic' and won;

create or replace function public.classic_leaderboard(p_week date default null, p_limit int default 50, p_friends boolean default false)
returns table (rank bigint, username text, games int, counted int, score int, is_me boolean, players bigint)
language sql stable security definer set search_path = '' as $$
  with wk as (
    select coalesce(p_week, date_trunc('week', now() at time zone 'utc')::date) as d
  ),
  valid as (
    select g.user_id, public.daily_points(g.guesses, g.mystery) as pts
    from public.games g, wk
    where g.mode = 'classic' and g.won
      and g.created_at >= (wk.d::timestamp at time zone 'utc')
      and g.created_at <  ((wk.d + 7)::timestamp at time zone 'utc')
      and coalesce(array_length(g.guesses, 1), 0) between 1 and 300
      and g.guesses[array_length(g.guesses, 1)] = g.mystery
      and (select count(distinct x) from unnest(g.guesses) x) = array_length(g.guesses, 1)
      and exists (select 1 from public.country_points c where c.country = g.mystery)
  ),
  best as (
    select user_id, pts, row_number() over (partition by user_id order by pts desc) as k
    from valid
  ),
  totals as (
    select user_id,
           count(*)::int                             as games,
           count(*) filter (where k <= 10)::int      as counted,
           (sum(pts) filter (where k <= 10))::int    as score
    from best
    group by user_id
  ),
  ranked as (
    select t.user_id, p.username, t.games, t.counted, t.score,
           row_number() over (order by t.score desc, t.counted, p.username) as rank,
           count(*) over () as players
    from totals t
    join public.profiles p on p.id = t.user_id
    where p.username is not null
      and (not p_friends
           or t.user_id = auth.uid()
           or t.user_id in (select friend_id from public.friendships where user_id = auth.uid()))
  )
  select rank, username, games, counted, score, user_id = auth.uid(), players
  from ranked
  where rank <= least(greatest(p_limit, 1), 100) or user_id = auth.uid()
  order by rank;
$$;

revoke all on function public.classic_leaderboard(date, int, boolean) from public, anon;
grant execute on function public.classic_leaderboard(date, int, boolean) to authenticated;
