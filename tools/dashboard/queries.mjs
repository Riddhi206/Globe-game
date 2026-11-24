// queries.mjs — every number on the dashboard. Read-only SQL against the
// Supabase database (or the in-memory demo database, see demo-db.mjs).
// $1 is the time range as a Postgres interval ('7 days'). Days and hours are IST.

export const TZ = 'Asia/Kolkata';
export const RANGES = { '24h': '24 hours', '7d': '7 days', '30d': '30 days', '90d': '90 days' };

// GameKatta's sites write gk_* events to the same table (gamekatta repo, shared/gk-track.js).
// Every Borderline number reads through this, so they never count; GameKatta has its own page (gk-queries.mjs).
const EV = `(select * from public.events where name not like 'gk\\_%')`;

const TODAY = `(now() at time zone '${TZ}')::date`;
const DAY = col => `(${col} at time zone '${TZ}')::date`;
// Days a series covers: the range, but never fewer than 7 (or more than 90)
const SPAN = `least(greatest(ceil(extract(epoch from $1::interval) / 86400)::int, 7), 90)`;

// Each player's first visit, with what brought them (app_open props carry referrer, src, ref, campaign, kind)
const FIRSTS = `select distinct on (user_id) user_id, created_at as first_at, ${DAY('created_at')} as day0, props as p
  from ${EV} ev where name = 'app_open' order by user_id, created_at`;

// Where a new player came from, from their first app_open
export const CHANNEL = `case
  when p->>'src' = 'challenge' or p->>'kind' = 'challenge' then 'Challenge link'
  when p->>'src' = 'room' or p->>'kind' = 'room' then 'Room invite'
  when p->>'src' = 'friend' or p->>'kind' = 'friend' then 'Friend invite'
  when p->>'src' in ('result', 'badge', 'founding', 'duel', 'story') then 'Shared ' || (p->>'src')
  when coalesce(p->>'campaign', '') <> '' or coalesce(p->>'src', '') <> '' then 'Campaign · ' || coalesce(nullif(p->>'campaign', ''), p->>'src')
  when coalesce(p->>'referrer', '') ~ '(^|\\.)(google|bing|duckduckgo|yahoo|yandex|ecosia|brave)\\.' then 'Search'
  when coalesce(p->>'referrer', '') ~ '(whatsapp|facebook|instagram|t\\.co|twitter|x\\.com|reddit|linkedin|telegram|snapchat|threads|discord)' then 'Social · ' || (p->>'referrer')
  when coalesce(p->>'referrer', '') <> '' and p->>'referrer' !~ '(borderline|gamekatta|classpathnotset|netlify|localhost)' then 'Website · ' || (p->>'referrer')
  else 'Direct / unknown' end`;

const SHARE_EVENTS = `('share', 'badge_share', 'challenge_share', 'room_invite_share', 'invite_share', 'story_share', 'duel_click')`;

export const Q = {
  // ---------------------------------------------------------------- overview
  // Two rows: this period and the one before it, for the ▲▼ comparisons
  kpis: `
    with periods as (select 'cur' as period, now() - $1::interval as a, now() as b
                     union all select 'prev', now() - 2 * $1::interval, now() - $1::interval),
         firsts as (${FIRSTS})
    select p.period,
      (select count(distinct user_id) from ${EV} e where e.created_at > p.a and e.created_at <= p.b) as players,
      (select count(*) from firsts f where f.first_at > p.a and f.first_at <= p.b) as new_players,
      (select count(*) from firsts f where f.first_at > p.a and f.first_at <= p.b and f.p ? 'ref') as viral_new,
      (select count(distinct session_id) from ${EV} e where e.created_at > p.a and e.created_at <= p.b) as sessions,
      (select count(*) from ${EV} e where e.name = 'game_end' and e.created_at > p.a and e.created_at <= p.b) as games,
      (select count(distinct user_id) from ${EV} e where e.name = 'game_end' and e.created_at > p.a and e.created_at <= p.b) as gamers,
      (select coalesce(sum((props->>'seconds')::numeric), 0) from ${EV} e where e.name = 'session_time' and e.created_at > p.a and e.created_at <= p.b) as seconds,
      (select count(distinct session_id) from ${EV} e where e.name = 'session_time' and e.created_at > p.a and e.created_at <= p.b) as timed_sessions,
      (select count(*) from ${EV} e where e.name in ${SHARE_EVENTS} and e.created_at > p.a and e.created_at <= p.b) as shares,
      (select count(distinct user_id) from ${EV} e where e.name in ${SHARE_EVENTS} and e.created_at > p.a and e.created_at <= p.b) as sharers,
      (select round(avg(n), 1) from (select count(distinct user_id) as n from ${EV} e
         where e.created_at > p.a and e.created_at <= p.b group by ${DAY('created_at')}) x) as avg_dau
    from periods p`,

  totals: `
    select
      (select count(*) from auth.users u where not exists (select 1 from public.events g where g.user_id = u.id and g.name like 'gk\\_%')) as total_players,
      (select count(*) from auth.users where not is_anonymous) as google_accounts,
      (select count(*) from public.profiles where username is not null) as with_username,
      (select count(distinct user_id) from ${EV} ev where ${DAY('created_at')} = ${TODAY}) as dau_today,
      (select count(distinct user_id) from ${EV} ev where created_at > now() - interval '7 days') as wau,
      (select count(distinct user_id) from ${EV} ev where created_at > now() - interval '30 days') as mau,
      (select count(*) from public.rooms where closed_at is null) as rooms_open`,

  // Active players per day, split into new and returning
  days: `
    with firsts as (select user_id, min(${DAY('created_at')}) as day0 from ${EV} ev where name = 'app_open' group by user_id),
         days as (select generate_series(${TODAY} - ${SPAN} + 1, ${TODAY}, interval '1 day')::date as day),
         ev as (select user_id, session_id, name, props, ${DAY('created_at')} as day from ${EV} ev
                where created_at > now() - make_interval(days => ${SPAN} + 1))
    select d.day,
      count(distinct ev.user_id) as active,
      (select count(*) from firsts f where f.day0 = d.day) as new_players,
      count(*) filter (where ev.name = 'game_end') as games,
      count(distinct ev.session_id) as sessions,
      count(distinct ev.user_id) filter (where ev.name = 'game_end' and ev.props->>'mode' = 'daily') as daily_players,
      round(sum((ev.props->>'seconds')::numeric) filter (where ev.name = 'session_time')
            / nullif(count(distinct ev.session_id) filter (where ev.name = 'session_time'), 0)) as avg_session_sec
    from days d left join ev on ev.day = d.day
    group by d.day order by d.day`,

  heatmap: `
    select extract(isodow from created_at at time zone '${TZ}')::int as dow,
           extract(hour from created_at at time zone '${TZ}')::int as hour,
           count(distinct session_id) as sessions
    from ${EV} ev where created_at > now() - $1::interval
    group by 1, 2`,

  // ---------------------------------------------------------------- acquisition
  channels: `
    with f as (${FIRSTS}),
         n as (select *, ${CHANNEL} as channel from f where first_at > now() - $1::interval)
    select channel, count(*) as players,
      count(*) filter (where exists (select 1 from ${EV} g where g.user_id = n.user_id and g.name = 'game_end')) as played,
      count(*) filter (where n.day0 + 1 < ${TODAY}) as d1_eligible,
      count(*) filter (where n.day0 + 1 < ${TODAY} and exists (select 1 from ${EV} r
                         where r.user_id = n.user_id and ${DAY('r.created_at')} = n.day0 + 1)) as d1
    from n group by channel order by players desc`,

  inviters: `
    with f as (${FIRSTS}),
         n as (select user_id, p->>'ref' as ref from f where first_at > now() - $1::interval and p ? 'ref'),
         t as (select ref, count(*) as invited,
                 count(*) filter (where exists (select 1 from ${EV} g where g.user_id = n.user_id and g.name = 'game_end')) as played
               from n group by ref)
    select t.ref, t.invited, t.played,
      (select username from public.profiles pr where left(replace(pr.id::text, '-', ''), 8) = t.ref limit 1) as username
    from t order by t.invited desc, t.played desc limit 15`,

  campaigns: `
    with f as (${FIRSTS})
    select coalesce(nullif(p->>'campaign', ''), p->>'src') as campaign, coalesce(p->>'medium', '') as medium, count(*) as players
    from f where first_at > now() - $1::interval and (coalesce(p->>'campaign', '') <> '' or (coalesce(p->>'src', '') <> ''
      and p->>'src' not in ('result', 'badge', 'founding', 'duel', 'story', 'room', 'challenge', 'friend')))
    group by 1, 2 order by 3 desc limit 15`,

  // ---------------------------------------------------------------- activation
  activation: `
    with f as (${FIRSTS}),
         n as (select user_id, first_at, day0 from f where first_at > now() - $1::interval),
         has as (select n.user_id, n.first_at, n.day0,
           bool_or(e.name = 'game_start') as started,
           bool_or(e.name = 'game_end') as finished,
           bool_or(e.name = 'game_end' and (e.props->>'won')::boolean) as won,
           count(*) filter (where e.name = 'game_end') as games,
           bool_or(e.name = 'tutorial_done') as tutorial,
           bool_or(e.name in ('room_join', 'room_create')) as roomed,
           bool_or(e.name in ${SHARE_EVENTS}) as shared,
           bool_or(${DAY('e.created_at')} = n.day0 + 1) as back_d1,
           min(e.created_at) filter (where e.name = 'game_end') as first_game_at
         from n left join ${EV} e on e.user_id = n.user_id group by n.user_id, n.first_at, n.day0)
    select count(*) as opened,
      count(*) filter (where started) as started,
      count(*) filter (where finished) as finished,
      count(*) filter (where won) as won,
      count(*) filter (where games >= 2) as second_game,
      count(*) filter (where tutorial) as tutorial,
      count(*) filter (where exists (select 1 from public.profiles pr where pr.id = has.user_id and pr.username is not null)) as named,
      count(*) filter (where shared) as shared,
      count(*) filter (where roomed) as roomed,
      count(*) filter (where exists (select 1 from auth.users u where u.id = has.user_id and not u.is_anonymous)) as google,
      count(*) filter (where day0 + 1 < ${TODAY}) as d1_eligible,
      count(*) filter (where day0 + 1 < ${TODAY} and back_d1) as back_d1,
      round(percentile_cont(0.5) within group (order by extract(epoch from first_game_at - first_at) / 60)::numeric, 1) as median_min_to_game
    from has`,

  // ---------------------------------------------------------------- retention
  cohorts: `
    with f as (select user_id, min(${DAY('created_at')}) as day0 from ${EV} ev where name = 'app_open' group by user_id),
         act as (select distinct user_id, ${DAY('created_at')} as day from ${EV} ev)
    select f.day0 as day, count(*) as new_players,
      ${[1, 3, 7, 14, 30].map(n => `case when f.day0 + ${n} < ${TODAY} then count(*) filter (where exists (select 1 from act a where a.user_id = f.user_id and a.day = f.day0 + ${n})) end as d${n}`).join(',\n      ')}
    from f where f.day0 > ${TODAY} - greatest(least(ceil(extract(epoch from $1::interval) / 86400)::int, 30), 14)
    group by f.day0 order by f.day0 desc`,

  cohortsWeekly: `
    with f as (select user_id, min(${DAY('created_at')}) as day0 from ${EV} ev where name = 'app_open' group by user_id),
         act as (select distinct user_id, ${DAY('created_at')} as day from ${EV} ev),
         w as (select user_id, date_trunc('week', day0)::date as week from f)
    select w.week, count(*) as new_players,
      ${[1, 2, 3, 4, 8].map(k => `case when w.week + ${7 * k + 6} < ${TODAY} then count(*) filter (where exists (select 1 from act a where a.user_id = w.user_id and a.day between w.week + ${7 * k} and w.week + ${7 * k + 6})) end as w${k}`).join(',\n      ')}
    from w where w.week > ${TODAY} - 7 * 12
    group by w.week order by w.week desc`,

  // Of last week's players, who came back this week; and who returned after 14+ days away
  churn: `
    with act as (select distinct user_id, ${DAY('created_at')} as day from ${EV} ev where created_at > now() - interval '60 days'),
         lastwk as (select distinct user_id from act where day between ${TODAY} - 13 and ${TODAY} - 7),
         thiswk as (select distinct user_id from act where day > ${TODAY} - 7)
    select (select count(*) from lastwk) as last_week,
           (select count(*) from lastwk where user_id in (select user_id from thiswk)) as kept,
           (select count(*) from thiswk t where not exists (select 1 from act a where a.user_id = t.user_id and a.day between ${TODAY} - 21 and ${TODAY} - 7)
              and exists (select 1 from act a where a.user_id = t.user_id and a.day < ${TODAY} - 21)) as resurrected`,

  // ---------------------------------------------------------------- engagement
  sessionLengths: `
    with s as (select session_id, sum((props->>'seconds')::numeric) as secs from ${EV} ev
               where name = 'session_time' and created_at > now() - $1::interval group by session_id)
    select case when secs < 60 then '< 1 min' when secs < 180 then '1–3 min' when secs < 600 then '3–10 min'
                when secs < 1800 then '10–30 min' else '30+ min' end as bucket, count(*) as sessions
    from s group by 1`,

  gamesPerPlayer: `
    with g as (select user_id, count(*) as n from ${EV} ev where name = 'game_end' and created_at > now() - $1::interval group by user_id)
    select case when n = 1 then '1' when n <= 3 then '2–3' when n <= 9 then '4–9' when n <= 19 then '10–19' else '20+' end as bucket,
           count(*) as players from g group by 1`,

  // Current Daily streaks (alive = played today or yesterday, UTC days like the game)
  streaks: `
    with d as (select distinct user_id, day from public.daily_scores),
         g as (select user_id, day, day - (row_number() over (partition by user_id order by day))::int as grp from d),
         runs as (select user_id, count(*) as len, max(day) as last_day from g group by user_id, grp)
    select case when len = 1 then '1 day' when len <= 3 then '2–3 days' when len <= 6 then '4–6 days'
                when len <= 13 then '1–2 weeks' when len <= 29 then '2–4 weeks' else '30+ days' end as bucket, count(*) as players
    from runs where last_day >= (now() at time zone 'utc')::date - 1 group by 1`,

  modes: `
    select props->>'mode' as mode,
      count(*) filter (where name = 'game_start' and not coalesce((props->>'resumed')::boolean, false)) as started,
      count(*) filter (where name = 'game_end') as finished,
      count(*) filter (where name = 'game_abandoned') as abandoned,
      count(distinct user_id) filter (where name = 'game_end') as players,
      round(100.0 * avg((props->>'won')::boolean::int) filter (where name = 'game_end')) as win_pct,
      round(avg((props->>'guesses')::numeric) filter (where name = 'game_end' and (props->>'won')::boolean), 1) as avg_guesses,
      round(avg((props->>'guesses')::numeric) filter (where name = 'game_abandoned'), 1) as avg_guesses_at_quit
    from ${EV} ev
    where name in ('game_start', 'game_end', 'game_abandoned') and created_at > now() - $1::interval
    group by 1 order by 2 desc`,

  guesses: `
    select case when not won then 'X' when guess_count >= 10 then '10+' else guess_count::text end as bucket, count(*) as games
    from public.games where played_at > now() - $1::interval group by 1`,

  daily: `
    select s.day, a.country, count(*) as players,
           round(100.0 * avg(s.won::int)) as win_pct,
           round(avg(s.guess_count) filter (where s.won), 1) as avg_guesses,
           max(s.score) as best_score
    from public.daily_scores s join public.daily_answers a on a.day = s.day
    where s.day > (now() at time zone 'utc')::date - greatest(ceil(extract(epoch from $1::interval) / 86400)::int, 7)
    group by s.day, a.country order by s.day desc`,

  // ---------------------------------------------------------------- social
  social: `
    select
      (select count(*) from public.rooms where closed_at is null) as rooms_open,
      (select count(*) from public.rooms where created_at > now() - $1::interval) as rooms_created,
      (select count(distinct user_id) from public.room_members) as players_in_rooms,
      (select round(avg(n), 1) from (select count(*) as n from public.room_members m join public.rooms r on r.id = m.room_id
         where r.closed_at is null group by m.room_id) x) as avg_members,
      (select count(*) from public.room_challenges where created_at > now() - $1::interval) as challenges,
      (select count(*) from (select challenge_id, user_id from public.challenge_results where started_at > now() - $1::interval
         group by 1, 2) x) as challenge_entries,
      (select count(*) from (select challenge_id, user_id from public.challenge_results where started_at > now() - $1::interval
         group by 1, 2 having count(submitted_at) = 5) x) as challenge_finishes,
      (select count(*) from public.room_nights where created_at > now() - $1::interval) as nights,
      (select round(avg(n), 1) from (select count(*) as n from public.night_players p join public.room_nights rn on rn.id = p.night_id
         where rn.created_at > now() - $1::interval group by p.night_id) x) as avg_night_players,
      (select count(*) / 2 from public.friendships) as friendships,
      (select count(*) from ${EV} ev where name = 'friend_request' and created_at > now() - $1::interval) as friend_requests,
      (select count(*) from ${EV} ev where name = 'rooms_open' and created_at > now() - $1::interval) as hub_opens,
      (select count(distinct user_id) from ${EV} ev where name = 'rooms_open' and created_at > now() - $1::interval) as hub_players`,

  challengeThemes: `
    select c.theme, c.speed, count(distinct c.id) as challenges,
      count(distinct (x.challenge_id, x.user_id)) as entries,
      round(avg(x.points) filter (where x.submitted_at is not null)) as avg_points,
      round(100.0 * avg(x.found::int) filter (where x.submitted_at is not null)) as found_pct
    from public.room_challenges c left join public.challenge_results x on x.challenge_id = c.id
    where c.created_at > now() - $1::interval
    group by 1, 2 order by 3 desc`,

  roomsTop: `
    select r.name, r.emoji, r.created_at::date as created,
      (select count(*) from public.room_members m where m.room_id = r.id) as members,
      (select count(*) from public.room_challenges c where c.room_id = r.id) as challenges,
      (select count(*) from public.room_nights n where n.room_id = r.id) as nights,
      (select count(distinct s.user_id) from public.room_members m join public.daily_scores s on s.user_id = m.user_id
         and s.day > (now() at time zone 'utc')::date - 7 where m.room_id = r.id) as weekly_daily_players
    from public.rooms r where r.closed_at is null
    order by members desc, challenges desc limit 15`,

  inviteFunnel: `
    with f as (${FIRSTS})
    select
      (select count(*) from ${EV} ev where name in ('room_invite_share', 'challenge_share') and created_at > now() - $1::interval) as invites_shared,
      (select count(distinct session_id) from ${EV} ev where name = 'app_open' and props->>'kind' in ('room', 'challenge')
         and created_at > now() - $1::interval) as link_visits,
      (select count(*) from f where first_at > now() - $1::interval and (p->>'kind' in ('room', 'challenge') or p->>'src' in ('room', 'challenge'))) as new_from_links,
      (select count(*) from ${EV} ev where name = 'room_join' and props->>'via' = 'link' and created_at > now() - $1::interval) as joins_via_link,
      (select count(*) from ${EV} ev where name = 'room_join' and created_at > now() - $1::interval) as joins`,

  // ---------------------------------------------------------------- sharing
  shareSurfaces: `
    select case name when 'share' then 'result' when 'badge_share' then 'badge' when 'challenge_share' then 'challenge'
                     when 'room_invite_share' then 'room' when 'invite_share' then 'friend' when 'story_share' then 'story'
                     when 'duel_click' then 'duel' end as surface,
           count(*) as times, count(distinct user_id) as sharers
    from ${EV} ev where name in ${SHARE_EVENTS} and created_at > now() - $1::interval
    group by 1 order by 2 desc`,

  // Visits through tagged links, by where the link was shared from, and the new players they brought
  linkConversion: `
    with f as (${FIRSTS}),
         v as (select coalesce(props->>'src', props->>'kind') as surface, count(distinct session_id) as visits, count(distinct user_id) as visitors
               from ${EV} ev where name = 'app_open' and created_at > now() - $1::interval and (props ? 'src' or props ? 'kind')
               group by 1)
    select v.surface, v.visits, v.visitors,
           (select count(*) from f where f.first_at > now() - $1::interval and coalesce(f.p->>'src', f.p->>'kind') = v.surface) as new_players
    from v order by v.visits desc`,

  shareMethods: `
    select props->>'method' as label, count(*) as times
    from ${EV} ev where name = 'share' and created_at > now() - $1::interval
    group by 1 order by 2 desc`,

  // ---------------------------------------------------------------- collection
  badges: `
    select props->>'badge' as badge, count(distinct user_id) as players
    from ${EV} ev where name = 'badge_card_shown' and created_at > now() - $1::interval
    group by 1 order by 2 desc`,

  collection: `
    select
      (select count(distinct user_id) from ${EV} ev where name = 'passport_open' and created_at > now() - $1::interval) as passport_players,
      (select count(*) from ${EV} ev where name = 'passport_open' and created_at > now() - $1::interval) as passport_opens,
      (select count(*) from ${EV} ev where name = 'badge_viewed' and created_at > now() - $1::interval) as trophy_views,
      (select count(*) from ${EV} ev where name = 'badge_share' and created_at > now() - $1::interval) as badge_shares,
      (select count(distinct user_id) from ${EV} ev where name = 'badge_card_shown' and created_at > now() - $1::interval) as unlockers,
      (select count(distinct user_id) from ${EV} ev where created_at < '2026-10-15T00:00:00Z' and name in ('game_end', 'game_abandoned')) as founding_players`,

  // ---------------------------------------------------------------- trivia
  triviaSummary: `
    select count(*) filter (where name = 'trivia_answer') as answered,
           round(100.0 * avg((props->>'correct')::boolean::int) filter (where name = 'trivia_answer')) as correct_pct,
           count(*) filter (where name = 'trivia_answer' and (props->>'timeout')::boolean) as timeouts,
           count(*) filter (where name = 'trivia_skip') as skips,
           count(*) filter (where name = 'hints_open') as hint_opens
    from ${EV} ev
    where name in ('trivia_answer', 'trivia_skip', 'hints_open') and created_at > now() - $1::interval`,

  triviaHardest: `
    select props->>'q' as question, props->>'country' as country, count(*) as asked,
           round(100.0 * avg((props->>'correct')::boolean::int)) as correct_pct,
           mode() within group (order by props->>'picked') filter (where not (props->>'correct')::boolean) as common_wrong
    from ${EV} ev
    where name = 'trivia_answer' and created_at > now() - $1::interval
    group by 1, 2 having count(*) >= 3
    order by correct_pct asc, asked desc limit 25`,

  // ---------------------------------------------------------------- story
  storyFunnel: `
    select (props->>'chapter')::int as chapter,
      count(distinct user_id) filter (where name = 'story_chapter_start') as players_started,
      count(distinct user_id) filter (where name = 'story_chapter_done') as players_done,
      count(*) filter (where name = 'story_chapter_done') as done,
      round(avg((props->>'saved')::numeric) filter (where name = 'story_chapter_done'), 1) as avg_saved,
      round(avg((props->>'guesses')::numeric) filter (where name = 'story_chapter_done'), 1) as avg_guesses,
      round(avg((props->>'seconds')::numeric) filter (where name = 'story_found'), 0) as avg_seconds,
      count(*) filter (where name = 'story_burn_cancel') as burn_cancels,
      count(*) filter (where name = 'story_pity') as pity
    from ${EV} ev
    where name in ('story_chapter_start', 'story_chapter_done', 'story_found', 'story_burn_cancel', 'story_pity')
      and props ? 'chapter' and created_at > now() - $1::interval
    group by 1 order by 1`,
  storySummary: `
    select
      count(distinct user_id) filter (where name = 'story_open') as openers,
      count(*) filter (where name = 'story_cold_open_done') as cold_opens,
      count(*) filter (where name = 'story_cold_open_done' and (props->>'skipped')::boolean) as cold_opens_skipped,
      count(*) filter (where name = 'story_chapter_start' and not coalesce((props->>'resumed')::boolean, false)) as chapter_starts,
      count(*) filter (where name = 'story_dialogue_skip') as dialogue_skips,
      count(*) filter (where name = 'story_burn_cancel') as burn_cancels,
      count(*) filter (where name = 'story_unlock_daily') as daily_unlocks,
      count(*) filter (where name = 'story_secret_found') as secrets,
      count(*) filter (where name = 'story_share') as shares,
      count(*) filter (where name = 'story_sound') as sound_answers,
      count(*) filter (where name = 'story_sound' and (props->>'on')::boolean) as sound_on,
      count(*) filter (where name = 'story_next') as next_shown,
      count(*) filter (where name = 'story_next' and props->>'action' = 'next') as next_chapter,
      count(*) filter (where name = 'story_next' and props->>'action' = 'daily') as next_daily
    from ${EV} ev
    where left(name, 6) = 'story_' and created_at > now() - $1::interval`,
  storyChoices: `
    select props->>'choice' as label,
      count(*) filter (where (props->>'first')::boolean) as first_choices, count(*) as all_choices
    from ${EV} ev where name = 'story_choice' and created_at > now() - $1::interval
    group by 1 order by 1`,
  storySkips: `
    select props->>'where' as label, count(*) as times
    from ${EV} ev where name = 'story_dialogue_skip' and created_at > now() - $1::interval
    group by 1 order by 2 desc`,

  // ---------------------------------------------------------------- tech
  ...Object.fromEntries([['devices', 'device'], ['os', 'os'], ['browsers', 'browser'], ['languages', 'lang'], ['timezones', 'tz'], ['versions', 'v']].map(([k, f]) => [k, `
    select coalesce(nullif(context->>'${f}', ''), '(unknown)') as label, count(distinct user_id) as players
    from ${EV} ev where name = 'app_open' and created_at > now() - $1::interval
    group by 1 order by 2 desc limit 12`])),
  referrers: `
    select coalesce(nullif(props->>'referrer', ''), '(direct / app)') as label, count(distinct user_id) as players
    from ${EV} ev where name = 'app_open' and created_at > now() - $1::interval
    group by 1 order by 2 desc limit 12`,
  installed: `
    select count(distinct user_id) filter (where (context->>'app')::boolean) as installed, count(distinct user_id) as players
    from ${EV} ev where name = 'app_open' and created_at > now() - $1::interval`,
  loadTimes: `
    select coalesce(context->>'device', '(unknown)') as device, count(*) as opens,
      round(percentile_cont(0.5) within group (order by (props->>'load_ms')::numeric)) as p50,
      round(percentile_cont(0.9) within group (order by (props->>'load_ms')::numeric)) as p90
    from ${EV} ev where name = 'app_open' and props ? 'load_ms' and created_at > now() - $1::interval
    group by 1 order by 2 desc`,
  banners: `
    select props->>'banner' as banner,
      count(*) filter (where name = 'banner_shown') as shown,
      count(*) filter (where name = 'banner_click') as clicks,
      count(*) filter (where name = 'banner_dismiss') as dismisses
    from ${EV} ev where name in ('banner_shown', 'banner_click', 'banner_dismiss') and created_at > now() - $1::interval
    group by 1 order by 2 desc`,

  // Feature use (times and players), for the long tail
  features: `
    select name as label, count(*) as times, count(distinct user_id) as players
    from ${EV} ev
    where created_at > now() - $1::interval
      and name not in ('app_open', 'game_start', 'game_end', 'game_abandoned', 'session_time', 'trivia_answer', 'tutorial_step')
      and left(name, 6) <> 'story_'
    group by 1 order by 2 desc limit 40`,

  // ---------------------------------------------------------------- notifications (017_push.sql; skipped before it's run)
  pushTotals: `
    select
      (select count(distinct user_id) from public.push_subscriptions) as players_on,
      (select count(*) from public.push_subscriptions) as devices,
      (select count(distinct user_id) from ${EV} ev where created_at > now() - $1::interval) as active,
      (select count(distinct s.user_id) from public.push_subscriptions s
        where exists (select 1 from ${EV} e where e.user_id = s.user_id and e.created_at > now() - $1::interval)) as active_on,
      (select count(*) filter (where ok) from public.push_log where created_at > now() - $1::interval) as sent,
      (select count(*) filter (where not ok) from public.push_log where created_at > now() - $1::interval) as failed,
      (select count(*) from ${EV} ev where name = 'push_open' and created_at > now() - $1::interval) as opened,
      (select count(distinct user_id) from ${EV} ev where name = 'push_prompt_shown' and created_at > now() - $1::interval) as asked,
      (select count(distinct user_id) from ${EV} ev where name = 'push_enabled' and created_at > now() - $1::interval) as enabled,
      (select count(distinct user_id) from ${EV} ev where name = 'push_denied' and created_at > now() - $1::interval) as denied,
      (select count(distinct user_id) from ${EV} ev where name = 'push_disabled' and created_at > now() - $1::interval) as turned_off`,

  // Sent and opened, per kind of notification
  pushKinds: `
    with s as (select kind, count(*) filter (where ok) as sent from public.push_log where created_at > now() - $1::interval group by kind),
         o as (select props->>'kind' as kind, count(*) as opened from ${EV} ev
               where name = 'push_open' and created_at > now() - $1::interval group by 1)
    select coalesce(s.kind, o.kind) as kind, coalesce(s.sent, 0) as sent, coalesce(o.opened, 0) as opened
    from s full join o on o.kind = s.kind where coalesce(s.kind, o.kind) <> '' order by sent desc`,

  pushDays: `
    with d as (select generate_series(${TODAY} - (${SPAN} - 1), ${TODAY}, '1 day')::date as day)
    select d.day,
      (select count(*) from public.push_log l where l.ok and ${DAY('l.created_at')} = d.day) as sent,
      (select count(*) from ${EV} e where e.name = 'push_open' and ${DAY('e.created_at')} = d.day) as opened
    from d order by d.day`,

  pushPlatforms: `
    select platform as label, count(distinct user_id) as players from public.push_subscriptions group by 1 order by 2 desc`,

  // Where players were asked, and what they said
  pushAsks: `
    select coalesce(props->>'source', '?') as source,
      count(*) filter (where name = 'push_prompt_shown') as shown,
      count(*) filter (where name = 'push_enabled') as enabled,
      count(*) filter (where name = 'push_denied') as denied,
      count(*) filter (where name = 'push_prompt_dismiss') as not_now
    from ${EV} ev
    where name in ('push_prompt_shown', 'push_enabled', 'push_denied', 'push_prompt_dismiss') and created_at > now() - $1::interval
    group by 1 order by 2 desc`,

  // Do players with notifications on come back more? Days active in the range, by group
  pushEffect: `
    with a as (select user_id, count(distinct ${DAY('created_at')}) as days from ${EV} ev
               where created_at > now() - $1::interval group by user_id),
         g as (select a.*, exists (select 1 from public.push_subscriptions s where s.user_id = a.user_id) as on_ from a)
    select case when on_ then 'Notifications on' else 'Notifications off' end as label,
           count(*) as players, round(avg(days), 1) as avg_days,
           round(100.0 * count(*) filter (where days >= 2) / nullif(count(*), 0)) as returned_pct
    from g group by on_ order by on_ desc`,

  // ---------------------------------------------------------------- feedback (019_feedback.sql; skipped before it's run)
  feedback: `
    select to_char(f.created_at at time zone '${TZ}', 'DD Mon HH24:MI') as time, f.kind, f.message, f.contact,
           coalesce(nullif(f.meta->>'username', ''), p.username, left(f.user_id::text, 8)) as player,
           f.meta->>'platform' as platform, f.meta->>'viewport' as viewport, (f.meta->>'games')::int as games
    from public.feedback f left join public.profiles p on p.id = f.user_id
    where f.created_at > now() - greatest($1::interval, interval '30 days')
    order by f.id desc limit 200`,

  // ---------------------------------------------------------------- live
  recent: `
    select to_char(e.created_at at time zone '${TZ}', 'DD Mon HH24:MI:SS') as time,
           coalesce(p.username, left(e.user_id::text, 8)) as player, e.name,
           e.props::text as details, e.context->>'device' as device, e.context->>'os' as os
    from ${EV} e left join public.profiles p on p.id = e.user_id
    order by e.created_at desc limit 200`,
};

// ---------------------------------------------------------------- player lookup
// $1: a leaderboard name (any case) or the start of a player id
// ---------------------------------------------------------------- Guide & features
// Captain Reed's intro, the tutorial tips, the 🔭 spyglass, the Atlas, his home facts and
// quiz, the hunt-radar share image, View globe, the Classic board, trivia picking.
export const FEATURES = {
  feat: `
    with ev as (select user_id, name, props from ${EV} ev where created_at > now() - $1::interval)
    select
      count(distinct user_id) filter (where name = 'captain_intro_start') as intro_started,
      count(distinct user_id) filter (where name = 'captain_name_set') as intro_named,
      count(distinct user_id) filter (where name = 'captain_intro_skip') as intro_skipped,
      percentile_cont(0.5) within group (order by (props->>'seconds')::numeric) filter (where name = 'captain_name_set') as name_seconds,
      count(*) filter (where name = 'captain_name_set' and (props->>'kept_rolled')::boolean) as kept_rolled,
      count(*) filter (where name = 'captain_name_set') as names,
      count(*) filter (where name = 'tip_shown') as tips_shown,
      count(*) filter (where name = 'tip_action') as tips_acted,
      count(*) filter (where name = 'spyglass_earn') as spy_earned,
      count(*) filter (where name = 'spyglass_use') as spy_used,
      count(distinct user_id) filter (where name = 'spyglass_use') as spy_users,
      count(*) filter (where name = 'spyglass_open') as spy_opened,
      count(*) filter (where name = 'spyglass_toggle' and (props->>'hidden')::boolean) as spy_hid,
      count(*) filter (where name = 'atlas_open') as atlas_opens,
      count(distinct user_id) filter (where name = 'atlas_open') as atlas_users,
      round(avg((props->>'seconds')::numeric) filter (where name = 'atlas_close')) as atlas_seconds,
      count(distinct user_id) filter (where name in ('captain_fact', 'captain_quiz')) as captain_tappers,
      count(*) filter (where name in ('captain_fact', 'captain_quiz')) as captain_taps,
      count(*) filter (where name = 'captain_quiz') as quiz_asked,
      count(*) filter (where name = 'captain_quiz_answer') as quiz_revealed,
      count(*) filter (where name = 'share') as shares,
      count(*) filter (where name = 'share' and (props->>'radar')::boolean) as radar_shares,
      count(*) filter (where name = 'result_globe_view') as globe_views,
      count(*) filter (where name = 'result_globe_replay') as globe_replays,
      count(*) filter (where name = 'leaderboard_view' and props->>'board' = 'classic') as classic_lb_views,
      count(distinct user_id) filter (where name = 'leaderboard_view' and props->>'board' = 'classic') as classic_lb_users,
      count(*) filter (where name = 'trivia_shown') as trivia_shown,
      count(*) filter (where name = 'trivia_shown' and (props->>'capital')::boolean) as trivia_capital,
      count(*) filter (where name = 'trivia_shown' and not (props->>'fresh')::boolean) as trivia_repeat,
      count(*) filter (where name = 'trivia_skip') as trivia_skips,
      count(*) filter (where name = 'trivia_answer') as trivia_answers,
      count(*) filter (where name = 'trivia_answer' and (props->>'correct')::boolean) as trivia_right
    from ev`,

  // New players from the Captain's first line to coming back another day (within their first day for the in-game steps)
  feat_funnel: `
    with starts as (select user_id, min(created_at) as t0 from ${EV} ev
                    where name = 'captain_intro_start' and created_at > now() - $1::interval group by user_id),
         ev as (select e.user_id, e.name, e.props from ${EV} e join starts s using (user_id)
                where e.created_at >= s.t0 and e.created_at < s.t0 + interval '1 day')
    select label, players from (values
      (1, 'Met the Captain',        (select count(*) from starts)),
      (2, 'Saved a name',           (select count(distinct user_id) from ev where name = 'captain_name_set')),
      (3, 'Made a first guess',     (select count(distinct user_id) from ev where name = 'tutorial_step' and (props->>'step')::int >= 1)),
      (4, 'Finished a game',        (select count(distinct user_id) from ev where name = 'game_end')),
      (5, 'Came back another day',  (select count(*) from starts s where exists (select 1 from ${EV} e where e.user_id = s.user_id
                                       and ${DAY('e.created_at')} > ${DAY('s.t0')})))
    ) v(o, label, players) order by o`,

  // Each tooltip: how often shown, and tapped through (or, for the search tip, answered by typing)
  feat_tips: `
    select coalesce(props->>'tip', '?') as tip,
      count(*) filter (where name = 'tip_shown') as shown,
      count(*) filter (where name = 'tip_action' and props->>'action' <> 'typed') as tapped,
      count(*) filter (where name = 'tip_action' and props->>'action' = 'typed') as typed
    from ${EV} ev where name in ('tip_shown', 'tip_action') and created_at > now() - $1::interval
    group by 1 order by shown desc`,

  // Does a spyglass change the Daily? Wins and guesses with and without one
  feat_spy_games: `
    select case when (props->>'spyglass')::boolean then 'With a spyglass' else 'Without' end as label,
      count(*) as games,
      round(100.0 * count(*) filter (where (props->>'won')::boolean) / nullif(count(*), 0)) as win_pct,
      round(avg((props->>'guesses')::numeric) filter (where (props->>'won')::boolean), 1) as avg_guesses
    from ${EV} ev
    where name = 'game_end' and props->>'mode' = 'daily' and props ? 'spyglass' and created_at > now() - $1::interval
    group by 1 order by 1 desc`,

  feat_days: `
    with days as (select generate_series(${TODAY} - ${SPAN} + 1, ${TODAY}, interval '1 day')::date as day),
         ev as (select name, ${DAY('created_at')} as day from ${EV} ev
                where created_at > now() - make_interval(days => ${SPAN} + 1)
                  and name in ('spyglass_use', 'spyglass_earn', 'atlas_open', 'captain_fact', 'captain_quiz'))
    select d.day,
      count(ev.name) filter (where ev.name = 'spyglass_earn') as spy_earned,
      count(ev.name) filter (where ev.name = 'spyglass_use') as spy_used,
      count(ev.name) filter (where ev.name = 'atlas_open') as atlas_opens,
      count(ev.name) filter (where ev.name in ('captain_fact', 'captain_quiz')) as captain_taps
    from days d left join ev on ev.day = d.day
    group by d.day order by d.day`,
};
Object.assign(Q, FEATURES);

export const PLAYER = {
  find: `
    select p.id, p.username, u.created_at, not u.is_anonymous as google,
      (select count(*) from public.games g where g.user_id = p.id) as games,
      (select count(*) from public.daily_scores s where s.user_id = p.id) as dailies,
      (select max(created_at) from ${EV} e where e.user_id = p.id) as last_seen,
      (select count(*) from public.room_members m where m.user_id = p.id) as rooms
    from public.profiles p join auth.users u on u.id = p.id
    where lower(p.username) like lower($1) || '%' or p.id::text like lower($1) || '%'
    order by last_seen desc nulls last limit 10`,
  events: `
    select to_char(created_at at time zone '${TZ}', 'DD Mon HH24:MI:SS') as time, name, props::text as details,
           context->>'device' as device, context->>'os' as os
    from ${EV} ev where user_id = $1::uuid order by created_at desc limit 300`,
  first: `
    select to_char(created_at at time zone '${TZ}', 'DD Mon YYYY HH24:MI') as first_seen, props::text as landing
    from ${EV} ev where user_id = $1::uuid and name = 'app_open' order by created_at limit 1`,
};
