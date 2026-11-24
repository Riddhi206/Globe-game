-- 027_daily_stats.sql — the numbers behind the Daily result screen.
-- Run after 021_scoring.sql. Safe to re-run. (026 is taken by feature/hatke-push.)
--
-- The result shows "You beat 64% of today's 212 players" and a chart of how many
-- guesses everyone needed. The leaderboard only returns the top 50, so neither can be
-- worked out exactly in the app; this counts every named player (and you, named or not).
--
--   players  everyone counted, you included
--   beat     how many of them scored less than you (null if you haven't played that day)
--   dist     11 counts: found in 1, 2, … 10 guesses, then missed

create or replace function public.daily_stats(p_day date default (now() at time zone 'utc')::date)
returns table (players int, beat int, dist int[])
language sql stable security definer set search_path = '' as $$
  with s as (
    select s.user_id, s.score,
           case when s.won then least(greatest(s.guess_count, 1), 10) else 11 end as bucket
    from public.daily_scores s
    left join public.profiles p on p.id = s.user_id
    where s.day = p_day and (p.username is not null or s.user_id = auth.uid())
  ),
  me as (select score from s where user_id = auth.uid())
  select
    (select count(*)::int from s),
    case when me.score is null then null
         else (select count(*)::int from s where s.score < me.score) end,
    array(select count(s.user_id)::int
          from generate_series(1, 11) as g(n)
          left join s on s.bucket = g.n
          group by g.n order by g.n)
  from (select 1) one left join me on true;
$$;

revoke all on function public.daily_stats(date) from public, anon;
grant execute on function public.daily_stats(date) to authenticated;
