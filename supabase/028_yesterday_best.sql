-- 028_yesterday_best.sql — "yesterday's best" on the home screens of Borderline, Tatva and Hatke.
-- Run after 024_tatva.sql. Safe to re-run.
--
-- gk_yesterday_best(site) → one row: the top named player of the site's previous day, or no
-- row when nobody played. Worked out once per site and day, then served from
-- gk_yesterday_best_cache, since every home-screen visit asks.
--
--   borderline  daily_scores of the previous UTC day (the Daily resets at 00:00 UTC), named players
--   tatva       tatva_scores of the previous IST day number, named players
--   hatke       gk_finish events of yesterday's Daily (Hatke has no score table or names yet).
--               Points are capped at the real maximum (5 rounds × 100); tests are left out. The
--               name is the GameKatta name the same browser (context.person) has used on a site
--               with the shared login, when there is one; otherwise name comes back null.
--
--   name      the player's username (null: a Hatke player without one)
--   score     their points
--   guesses   Borderline guesses / Tatva darts used (null for Hatke)
--   won       whether they found it (null for Hatke)
--   players   how many played that day
--   day       the day it's about (Borderline, Hatke: the date; Tatva: the day number as text)

create table if not exists public.gk_yesterday_best_cache (
  site     text not null,
  day      text not null,
  name     text,
  score    int,
  guesses  int,
  won      boolean,
  players  int  not null default 0,
  made_at  timestamptz not null default now(),
  primary key (site, day)
);
alter table public.gk_yesterday_best_cache enable row level security;   -- no policies: only the function reads it

create or replace function public.gk_yesterday_best(p_site text)
returns table (name text, score int, guesses int, won boolean, players int, day text)
language plpgsql volatile security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_day   text;
  v_row   public.gk_yesterday_best_cache;
  v_date  date;
  v_from  timestamptz;
  v_to    timestamptz;
begin
  if p_site = 'borderline' then
    v_date := (now() at time zone 'utc')::date - 1;
    v_day  := v_date::text;
  elsif p_site = 'tatva' then
    v_day  := (public._tatva_today() - 1)::text;
  elsif p_site = 'hatke' then
    v_date := (now() at time zone 'Asia/Kolkata')::date - 1;
    v_day  := v_date::text;
  else
    return;
  end if;

  select * into v_row from public.gk_yesterday_best_cache c where c.site = p_site and c.day = v_day;

  if not found then
    v_row.site := p_site; v_row.day := v_day; v_row.players := 0;

    if p_site = 'borderline' then
      select p.username, s.score, s.guess_count, s.won
        into v_row.name, v_row.score, v_row.guesses, v_row.won
      from public.daily_scores s join public.profiles p on p.id = s.user_id
      where s.day = v_date and p.username is not null
      order by s.score desc, s.created_at limit 1;
      select count(*) into v_row.players
      from public.daily_scores s join public.profiles p on p.id = s.user_id
      where s.day = v_date and p.username is not null;

    elsif p_site = 'tatva' then
      select p.username, s.points, s.used, s.won
        into v_row.name, v_row.score, v_row.guesses, v_row.won
      from public.tatva_scores s join public.profiles p on p.id = s.user_id
      where s.day_no = v_day::int and p.username is not null
      order by s.points desc, s.lifelines, s.created_at limit 1;
      select count(*) into v_row.players
      from public.tatva_scores s join public.profiles p on p.id = s.user_id
      where s.day_no = v_day::int and p.username is not null;

    else -- hatke
      -- Yesterday's Daily number: #1 was 9 Oct 2026 (IST). Finishes can land a little after midnight.
      v_from := (v_date::timestamp) at time zone 'Asia/Kolkata';
      v_to   := v_from + interval '1 day 2 hours';
      with f as (
        select e.context->>'person' as person, least((e.props->>'pts')::int, 500) as pts, e.created_at
        from public.events e
        where e.name = 'gk_finish' and e.created_at >= v_from and e.created_at < v_to
          and e.context->>'site' = 'hatke' and e.props->>'mode' = 'daily'
          and e.props->>'n' = ((v_date - date '2026-10-09') + 1)::text
          and (e.props->>'pts') ~ '^\d{1,4}$'
          and coalesce(e.context->>'test', 'false') <> 'true'
          and e.context->>'person' is not null
      ),
      best as (   -- one finish per browser: its first
        select distinct on (person) person, pts, created_at from f order by person, created_at
      )
      select b.person, b.pts, (select count(*) from best)::int
        into v_row.name, v_row.score, v_row.players
      from best b order by b.pts desc, b.created_at limit 1;

      -- v_row.name holds the person id for now; swap in their GameKatta name, if they have one
      if v_row.name is not null then
        v_row.name := (
          select p.username
          from public.events e join public.profiles p on p.id = e.user_id
          where e.created_at > now() - interval '60 days'
            and e.context->>'person' = v_row.name and p.username is not null
          order by e.created_at desc limit 1);
      end if;
      v_row.players := coalesce(v_row.players, 0);
    end if;

    insert into public.gk_yesterday_best_cache (site, day, name, score, guesses, won, players)
    values (p_site, v_day, v_row.name, v_row.score, v_row.guesses, v_row.won, v_row.players)
    on conflict on constraint gk_yesterday_best_cache_pkey do nothing;
  end if;

  if v_row.score is null then return; end if;   -- nobody played
  return query select v_row.name, v_row.score, v_row.guesses, v_row.won, v_row.players, v_row.day;
end;
$$;

revoke all on function public.gk_yesterday_best(text) from public, anon;
grant execute on function public.gk_yesterday_best(text) to authenticated;

-- Old cache rows aren't needed after a few days
delete from public.gk_yesterday_best_cache where made_at < now() - interval '14 days';
