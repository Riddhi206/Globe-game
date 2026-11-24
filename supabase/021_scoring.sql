-- 021_scoring.sql — Daily points worked out on the server, and the points ARE the rank.
-- Run after 020_country_points.sql. Safe to re-run.
--
--   Found in 1 guess:  1000
--   Found in n:        (11 − n) × 100 + aim (0–99)      2 = 900–999 … 10 = 100–199
--   Not found:         aim from the closest guess (0–99)
--   aim = floor(99 × (Z·k − Σkm) / (Z·k)), floored at 0, Z = 10,000 km,
--         over the k guesses before the answer (whole km, centre to centre)
--
-- Mirrors calcScore() in scoring.js. The old formula (opener rarity, trivia) is gone:
-- the server could only cap it, never check it. Now the app's number is display only;
-- submit_daily stores the server's own.
--
-- Because each guess count gets its own band of 100, sorting by points gives the same
-- order as "won, fewest guesses" did. Re-scoring old Dailies below only reorders
-- players who tied on guesses (by aim instead of the old opener bonus). The room
-- leagues (009/011) still sort by won, guesses, score: same order, nothing to change.

-- Whole km between two countries' centres (null if either is unknown)
create or replace function public.centre_km(p_a text, p_b text)
returns int
language sql stable security definer set search_path = '' as $$
  select round(6371 * 2 * atan2(sqrt(h), sqrt(1 - h)))::int
  from (
    select sin(radians(b.lat - a.lat) / 2) ^ 2
         + cos(radians(a.lat)) * cos(radians(b.lat)) * sin(radians(b.lon - a.lon) / 2) ^ 2 as h
    from public.country_points a, public.country_points b
    where a.country = p_a and b.country = p_b
  ) x;
$$;

create or replace function public.daily_points(p_guesses text[], p_answer text)
returns int
language plpgsql stable security definer set search_path = '' as $$
declare
  z   constant bigint := 10000;
  n   int    := coalesce(array_length(p_guesses, 1), 0);
  s   bigint := 0;
  k   int;
begin
  if n = 0 then
    return 0;
  end if;
  if p_guesses[n] = p_answer then
    if n = 1 then
      return 1000;
    end if;
    for i in 1 .. n - 1 loop
      s := s + coalesce(public.centre_km(p_guesses[i], p_answer), z);   -- unknown counts as far
    end loop;
    return greatest(1, 11 - n) * 100 + greatest(0, (99 * (z * (n - 1) - s)) / (z * (n - 1)))::int;
  end if;
  select min(coalesce(public.centre_km(g, p_answer), z)) into k from unnest(p_guesses) g;
  return greatest(0, (99 * (z - k)) / z)::int;
end $$;

-- Same checks as before; p_score is still accepted (older apps send it) but ignored
create or replace function public.submit_daily(p_day date, p_guesses text[], p_score int)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid    uuid := auth.uid();
  v_today  date := (now() at time zone 'utc')::date;
  v_n      int  := coalesce(array_length(p_guesses, 1), 0);
  v_answer text;
  v_won    boolean;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  if p_day > v_today or p_day < v_today - 1 then
    raise exception 'daily % is closed', p_day;
  end if;

  select country into v_answer from public.daily_answers where day = p_day;
  if v_answer is null then
    raise exception 'no answer for %', p_day;
  end if;

  if v_n < 1 or v_n > 10 then
    raise exception 'bad guess count';
  end if;
  if (select count(distinct g) from unnest(p_guesses) g) <> v_n then
    raise exception 'duplicate guesses';
  end if;

  v_won := p_guesses[v_n] = v_answer;
  if not v_won and (v_n < 10 or v_answer = any(p_guesses)) then
    raise exception 'unfinished game';
  end if;

  insert into public.daily_scores (day, user_id, won, guess_count, score, guesses)
  values (p_day, v_uid, v_won, v_n, public.daily_points(p_guesses, v_answer), p_guesses)
  on conflict (day, user_id) do nothing;
end $$;

revoke all on function public.centre_km(text, text)           from public, anon, authenticated;
revoke all on function public.daily_points(text[], text)      from public, anon, authenticated;
revoke all on function public.submit_daily(date, text[], int) from public, anon;
grant execute on function public.submit_daily(date, text[], int) to authenticated;

-- The leaderboard: points first. Same order as before for different guess counts;
-- among equal guesses, the sharper aim now wins instead of the luckier opener.
create or replace function public.daily_leaderboard(p_day date, p_limit int default 50, p_friends boolean default false)
returns table (rank bigint, username text, won boolean, guess_count int, score int, is_me boolean, players bigint)
language sql stable security definer set search_path = '' as $$
  with ranked as (
    select s.user_id, p.username, s.won, s.guess_count, s.score,
           row_number() over (order by s.score desc, s.created_at) as rank,
           count(*) over () as players
    from public.daily_scores s
    join public.profiles p on p.id = s.user_id
    where s.day = p_day and p.username is not null
      and (not p_friends
           or s.user_id = auth.uid()
           or s.user_id in (select friend_id from public.friendships where user_id = auth.uid()))
  )
  select rank, username, won, guess_count, score, user_id = auth.uid(), players
  from ranked
  where rank <= least(greatest(p_limit, 1), 100) or user_id = auth.uid()
  order by rank;
$$;

create index if not exists daily_scores_points_idx on public.daily_scores (day, score desc, created_at);

-- Re-score every Daily already played (leaderboard copies and synced game records)
update public.daily_scores s
set score = public.daily_points(s.guesses, a.country)
from public.daily_answers a
where a.day = s.day;

update public.games g
set score = public.daily_points(g.guesses, g.mystery)
where g.mode = 'daily' and g.guesses is not null and array_length(g.guesses, 1) > 0;
