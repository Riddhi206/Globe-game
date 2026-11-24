-- 002_leaderboard.sql — usernames, Daily answers and the Daily leaderboard.
-- Run after schema.sql, then run 003_daily_answers.sql. Safe to re-run.

-- ============================================================
-- Games keep their guess list (needed to verify a Daily)
-- ============================================================
alter table public.games add column if not exists guesses text[];

-- ============================================================
-- Usernames are unique regardless of case
-- ============================================================
alter table public.profiles drop constraint if exists profiles_username_key;
create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username));

-- ============================================================
-- Daily answers — generated from the game code (003_daily_answers.sql).
-- RLS on with no policies: only the functions below can read it.
-- ============================================================
create table if not exists public.daily_answers (
  day     date primary key,
  country text not null
);
alter table public.daily_answers enable row level security;

-- ============================================================
-- Daily scores — one per player per day, written only by submit_daily()
-- ============================================================
create table if not exists public.daily_scores (
  day         date not null,
  user_id     uuid not null references auth.users on delete cascade,
  won         boolean not null,
  guess_count int  not null,
  score       int  not null,
  guesses     text[] not null,
  created_at  timestamptz not null default now(),
  primary key (day, user_id)
);
create index if not exists daily_scores_rank_idx
  on public.daily_scores (day, won desc, guess_count, score desc, created_at);
alter table public.daily_scores enable row level security;

-- ============================================================
-- submit_daily — checks a finished Daily against the real answer.
-- Rules mirror game.js / scoring.js:
--   · 1–10 distinct guesses; a win ends on the answer, a loss uses all 10
--   · score ≤ 1000 − 80 per extra guess + 300 opener + 50 per trivia
--     (trivia comes every 3rd guess while the game is still going); losses score 0
--   · only today's or yesterday's Daily (UTC), so late offline syncs still count
-- ============================================================
create or replace function public.submit_daily(p_day date, p_guesses text[], p_score int)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid    uuid := auth.uid();
  v_today  date := (now() at time zone 'utc')::date;
  v_n      int  := coalesce(array_length(p_guesses, 1), 0);
  v_answer text;
  v_won    boolean;
  v_max    int;
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

  v_max := case when v_won then 1000 - 80 * (v_n - 1) + 300 + 50 * ((v_n - 1) / 3) else 0 end;
  if p_score < 0 or p_score > v_max then
    raise exception 'impossible score';
  end if;

  insert into public.daily_scores (day, user_id, won, guess_count, score, guesses)
  values (p_day, v_uid, v_won, v_n, p_score, p_guesses)
  on conflict (day, user_id) do nothing;
end $$;

-- ============================================================
-- daily_leaderboard — top players for a day (players with a username),
-- plus the caller's own row wherever they rank.
-- ============================================================
create or replace function public.daily_leaderboard(p_day date, p_limit int default 50)
returns table (rank bigint, username text, won boolean, guess_count int, score int, is_me boolean, players bigint)
language sql stable security definer set search_path = '' as $$
  with ranked as (
    select s.user_id, p.username, s.won, s.guess_count, s.score,
           row_number() over (order by s.won desc, s.guess_count, s.score desc, s.created_at) as rank,
           count(*) over () as players
    from public.daily_scores s
    join public.profiles p on p.id = s.user_id
    where s.day = p_day and p.username is not null
  )
  select rank, username, won, guess_count, score, user_id = auth.uid(), players
  from ranked
  where rank <= least(greatest(p_limit, 1), 100) or user_id = auth.uid()
  order by rank;
$$;

revoke all on function public.submit_daily(date, text[], int)   from public, anon;
revoke all on function public.daily_leaderboard(date, int)      from public, anon;
grant execute on function public.submit_daily(date, text[], int) to authenticated;
grant execute on function public.daily_leaderboard(date, int)    to authenticated;
