-- 023_hatke_misses.sql — what Hatke players typed that the answer bank didn't know.
-- Run after 005_events.sql. Safe to re-run.
--
-- The game logs each rejected answer as a gk_miss event (prompt id + what was typed, at most five per
-- prompt per game). gamekatta/tools/hatke/misses.mjs reads them through this function to grow the bank.
-- It returns only totals per prompt and typed text: no user ids, sessions or devices.

create or replace function public.hatke_misses(since_days int default 30)
returns table (prompt text, said text, players bigint, times bigint, last_seen timestamptz)
language sql stable security definer set search_path = public as $$
  select e.props->>'prompt', lower(btrim(e.props->>'said')), count(distinct e.user_id), count(*), max(e.created_at)
  from public.events e
  where e.name = 'gk_miss'
    and e.props->>'game' = 'hatke'
    and e.created_at > now() - make_interval(days => least(greatest(since_days, 1), 365))
    and e.props->>'prompt' is not null
    and length(btrim(e.props->>'said')) between 2 and 40
  group by 1, 2
  order by 3 desc, 4 desc
  limit 5000
$$;

revoke all on function public.hatke_misses(int) from public;
grant execute on function public.hatke_misses(int) to anon, authenticated;
