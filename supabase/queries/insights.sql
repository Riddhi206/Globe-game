-- insights.sql — ready-made questions about the game.
-- Paste one query at a time into Supabase → SQL Editor and Run.
-- Read-only: none of these change anything.

-- ============================================================
-- 1. Daily active players (last 30 days)
--    Anyone who opened the app, and anyone who finished a game.
-- ============================================================
select d::date as day,
       (select count(distinct user_id) from public.events e
         where e.name = 'app_open' and e.created_at::date = d::date) as opened,
       (select count(distinct user_id) from public.games g
         where g.played_at::date = d::date) as played
from generate_series(current_date - 29, current_date, interval '1 day') d
order by day desc;

-- ============================================================
-- 2. Retention — of players who first opened the app on a given day,
--    how many came back 1 day and 7 days later?
-- ============================================================
with first_seen as (
  select user_id, min(created_at)::date as day0
  from public.events where name = 'app_open' group by user_id
),
seen as (
  select distinct user_id, created_at::date as day from public.events where name = 'app_open'
)
select f.day0,
       count(*)                                                                         as new_players,
       count(*) filter (where exists (select 1 from seen s where s.user_id = f.user_id and s.day = f.day0 + 1)) as back_day_1,
       count(*) filter (where exists (select 1 from seen s where s.user_id = f.user_id and s.day = f.day0 + 7)) as back_day_7
from first_seen f
where f.day0 >= current_date - 30
group by f.day0
order by f.day0 desc;

-- ============================================================
-- 3. How hard was each Daily? (win rate and average guesses)
-- ============================================================
select s.day, a.country,
       count(*)                                        as players,
       round(100.0 * avg(s.won::int), 0)               as win_pct,
       round(avg(s.guess_count) filter (where s.won), 1) as avg_guesses_when_won
from public.daily_scores s
join public.daily_answers a on a.day = s.day
group by s.day, a.country
order by s.day desc
limit 30;

-- ============================================================
-- 4. Funnel — started vs finished games per mode (last 7 days)
--    A big gap means people give up; worth checking which mode.
-- ============================================================
select props->>'mode' as mode,
       count(*) filter (where name = 'game_start' and not (props->>'resumed')::boolean) as started,
       count(*) filter (where name = 'game_end')                                         as finished
from public.events
where name in ('game_start', 'game_end') and created_at > now() - interval '7 days'
group by 1
order by 2 desc;

-- ============================================================
-- 5. Hardest trivia questions (asked at least 10 times)
--    Very low % = too hard or badly worded; check "most picked wrong".
-- ============================================================
select props->>'q' as question,
       count(*)                                                    as asked,
       round(100.0 * avg((props->>'correct')::boolean::int), 0)    as correct_pct,
       mode() within group (order by props->>'picked')
         filter (where not (props->>'correct')::boolean)           as most_picked_wrong
from public.events
where name = 'trivia_answer'
group by 1
having count(*) >= 10
order by correct_pct asc
limit 25;

-- ============================================================
-- 6. Devices and browsers (last 30 days, unique players)
-- ============================================================
select context->>'device' as device, context->>'os' as os, context->>'browser' as browser,
       bool_or((context->>'app')::boolean) as any_installed,
       count(distinct user_id) as players
from public.events
where name = 'app_open' and created_at > now() - interval '30 days'
group by 1, 2, 3
order by players desc;

-- ============================================================
-- 7. Where players come from (referrer site; blank = typed/app/unknown)
-- ============================================================
select coalesce(nullif(props->>'referrer', ''), '(direct)') as referrer,
       count(distinct user_id) as players
from public.events
where name = 'app_open' and (props->>'first_visit')::boolean and created_at > now() - interval '30 days'
group by 1
order by players desc;

-- ============================================================
-- 8. Growth features — how often each is used (last 30 days)
-- ============================================================
select name, count(*) as times, count(distinct user_id) as players
from public.events
where name in ('share', 'invite_share', 'invite_open', 'friend_request', 'leaderboard_view',
               'signin_click', 'username_set', 'install_click', 'app_installed')
  and created_at > now() - interval '30 days'
group by name
order by times desc;

-- ============================================================
-- 9. Accounts — guests vs Google, and how many chose a name
-- ============================================================
select count(*)                                          as total_players,
       count(*) filter (where not u.is_anonymous)        as google_accounts,
       count(p.username)                                 as with_username,
       count(*) filter (where u.last_sign_in_at > now() - interval '7 days') as active_7d
from auth.users u
left join public.profiles p on p.id = u.id;
