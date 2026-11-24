// gk-queries.mjs — every number on the GameKatta page (/gk). Read-only SQL over the gk_* events that
// gamekatta.com and its games send to public.events (gamekatta repo, shared/gk-track.js).
// $1 is the time range as a Postgres interval ('7 days'); $2 the site: 'all', 'hub', 'hatke', 'tatva', ...
// Every query reads through GK, which uses both, so both are always passed. Days and hours are IST.
//
// A player is context.person: one random id per browser, shared by every *.gamekatta.com site through
// a cookie (trackers from 2026.10.17). Older events only have the site's own sign-in id (user_id), one
// per browser per site; once that browser shows up again with a person id, its old events are counted
// under the person too. Until then "all sites" counts someone who played Hatke and Tatva twice.
// iPhones clear a site's storage after 7 days without a visit, so day-14/30 returns there are low.

import { TZ } from './queries.mjs';

const TODAY = `(now() at time zone '${TZ}')::date`;
const DAY = col => `(${col} at time zone '${TZ}')::date`;
const SPAN = `least(greatest(ceil(extract(epoch from $1::interval) / 86400)::int, 7), 90)`;
const IN_RANGE = col => `${col} > now() - $1::interval`;

// Our own testing. Trackers mark it (context.test); this covers what came before that:
// the multi-device Playwright playtest of 16 Oct 2026, every one of its browsers set to en-GB.
const TEST_WINDOWS = [['2026-10-16 07:00+05:30', '2026-10-16 08:00+05:30', 'en-GB']];
const NOT_TEST = `coalesce(e.context->>'test', '') <> 'true' and name <> 'gk_test'
  and not (${TEST_WINDOWS.map(([a, b, lang]) => `(e.created_at >= '${a}' and e.created_at < '${b}' and e.context->>'lang' = '${lang}')`).join(' or ')})`;
const UUID = `'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'`;

// user_id here is the player: the event's person id, else the person its sign-in id later turned out to be, else the sign-in id
const GK = `(select e.id, coalesce(case when e.context->>'person' ~ ${UUID} then (e.context->>'person')::uuid end, m.person, e.user_id) as user_id,
    e.session_id, e.name, e.props, e.context, e.created_at
  from public.events e
  left join (select distinct on (user_id) user_id, (context->>'person')::uuid as person from public.events
             where name like 'gk\\_%' and context->>'person' ~ ${UUID} order by user_id, created_at) m on m.user_id = e.user_id
  where e.name like 'gk\\_%' and ${NOT_TEST}
  and $1::interval is not null and ($2::text = 'all' or e.props->>'game' = $2::text))`;

// Is this gk_open (alias a) the player's first?
const FIRST_OPEN = a => `not exists (select 1 from ${GK} fo where fo.user_id = ${a}.user_id and fo.name = 'gk_open' and fo.created_at < ${a}.created_at)`;

// Each player's first visit, with what brought them
const FIRSTS = `select distinct on (user_id) user_id, created_at as first_at, ${DAY('created_at')} as day0, props as p
  from ${GK} f0 where name = 'gk_open' order by user_id, created_at`;

// Where a new player came from, from their first gk_open
export const GK_CHANNEL = `case
  when p->>'s' = 'share' then 'Shared result'
  when p->>'s' = 'room' then 'Room invite'
  when p->>'utm_source' = 'cafe' then 'Cafe QR · ' || coalesce(nullif(p->>'utm_campaign', ''), '?')
  when p->>'utm_medium' = 'next' then 'Next-game link · from ' || (p->>'utm_source')
  when coalesce(p->>'utm_source', '') <> '' or coalesce(p->>'utm_campaign', '') <> '' then 'Campaign · ' || coalesce(nullif(p->>'utm_campaign', ''), p->>'utm_source')
  when coalesce(p->>'referrer', '') ~ '(^|\\.)gamekatta\\.com$' then 'From ' || (p->>'referrer')
  when coalesce(p->>'referrer', '') ~ '(^|\\.)(google|bing|duckduckgo|yahoo|yandex|ecosia|brave)\\.' then 'Search'
  when coalesce(p->>'referrer', '') ~ '(whatsapp|facebook|instagram|t\\.co|twitter|x\\.com|reddit|linkedin|telegram|snapchat|threads|discord)' then 'Social · ' || (p->>'referrer')
  when coalesce(p->>'referrer', '') <> '' then 'Website · ' || (p->>'referrer')
  else 'Direct / unknown' end`;

// "Played" = started or finished anything (room games only send starts)
const PLAYED = `name in ('gk_start', 'gk_finish')`;

export const GQ = {
  // ---------------------------------------------------------------- overview
  kpis: `
    with periods as (select 'cur' as period, now() - $1::interval as a, now() as b
                     union all select 'prev', now() - 2 * $1::interval, now() - $1::interval),
         ev as (select * from ${GK} e0 where created_at > now() - 2 * $1::interval),
         firsts as (${FIRSTS})
    select p.period,
      (select count(distinct user_id) from ev e where e.created_at > p.a and e.created_at <= p.b) as players,
      (select count(*) from firsts f where f.first_at > p.a and f.first_at <= p.b) as new_players,
      (select count(*) from firsts f where f.first_at > p.a and f.first_at <= p.b and f.p->>'s' = 'share') as share_new,
      (select count(distinct session_id) from ev e where e.created_at > p.a and e.created_at <= p.b) as sessions,
      (select count(*) from ev e where e.name = 'gk_start' and e.created_at > p.a and e.created_at <= p.b) as starts,
      (select count(*) from ev e where e.name = 'gk_finish' and e.created_at > p.a and e.created_at <= p.b) as finishes,
      (select count(distinct user_id) from ev e where e.${PLAYED} and e.created_at > p.a and e.created_at <= p.b) as gamers,
      (select coalesce(sum((props->>'seconds')::numeric), 0) from ev e where e.name = 'gk_time' and e.created_at > p.a and e.created_at <= p.b) as seconds,
      (select count(distinct session_id) from ev e where e.name = 'gk_time' and e.created_at > p.a and e.created_at <= p.b) as timed_sessions,
      (select count(*) from ev e where e.name = 'gk_share' and e.created_at > p.a and e.created_at <= p.b) as shares,
      (select count(*) from ev e where e.name = 'gk_room_create' and e.created_at > p.a and e.created_at <= p.b) as rooms,
      (select count(*) from ev e where e.name = 'gk_error' and e.created_at > p.a and e.created_at <= p.b) as errors,
      (select round(avg(n), 1) from (select count(distinct user_id) as n from ev e
         where e.created_at > p.a and e.created_at <= p.b group by ${DAY('created_at')}) x) as avg_dau
    from periods p`,

  totals: `
    with ev as (select user_id, created_at from ${GK} e0 where created_at > now() - interval '30 days')
    select
      (select count(distinct user_id) from ev where ${DAY('created_at')} = ${TODAY}) as dau_today,
      (select count(distinct user_id) from ev where created_at > now() - interval '7 days') as wau,
      (select count(distinct user_id) from ev) as mau,
      (select count(distinct user_id) from ${GK} e1) as all_time`,

  days: `
    with firsts as (select user_id, min(${DAY('created_at')}) as day0 from ${GK} f0 where name = 'gk_open' group by user_id),
         days as (select generate_series(${TODAY} - ${SPAN} + 1, ${TODAY}, interval '1 day')::date as day),
         ev as (select user_id, session_id, name, props, ${DAY('created_at')} as day from ${GK} e0
                where created_at > now() - make_interval(days => ${SPAN} + 1))
    select d.day,
      count(distinct ev.user_id) as active,
      (select count(*) from firsts f where f.day0 = d.day) as new_players,
      count(*) filter (where ev.name = 'gk_finish') as finishes,
      count(*) filter (where ev.name = 'gk_share') as shares,
      count(distinct ev.user_id) filter (where ev.name = 'gk_finish' and ev.props->>'mode' = 'daily') as daily_players,
      round(sum((ev.props->>'seconds')::numeric) filter (where ev.name = 'gk_time')
            / nullif(count(distinct ev.session_id) filter (where ev.name = 'gk_time'), 0)) as avg_session_sec
    from days d left join ev on ev.day = d.day
    group by d.day order by d.day`,

  // Players per day per site, for the stacked chart
  daysBySite: `
    select ${DAY('created_at')} as day, props->>'game' as site, count(distinct user_id) as players
    from ${GK} e0 where created_at > now() - make_interval(days => ${SPAN})
    group by 1, 2 order by 1`,

  heatmap: `
    select extract(isodow from created_at at time zone '${TZ}')::int as dow,
           extract(hour from created_at at time zone '${TZ}')::int as hour,
           count(distinct session_id) as sessions
    from ${GK} e0 where ${IN_RANGE('created_at')}
    group by 1, 2`,

  // The growth plan's gates, for players whose first visit was in range
  gates: `
    with f as (${FIRSTS}),
         n as (select * from f where first_at > now() - $1::interval),
         has as (select n.user_id, n.day0,
           bool_or(e.${PLAYED}) as played,
           bool_or(e.name = 'gk_finish') as finished,
           bool_or(${DAY('e.created_at')} = n.day0 + 1) as d1,
           bool_or(${DAY('e.created_at')} = n.day0 + 7) as d7
         from n join ${GK} e on e.user_id = n.user_id group by n.user_id, n.day0)
    select count(*) as new_players,
      count(*) filter (where played) as played,
      count(*) filter (where finished) as finished,
      count(*) filter (where day0 + 1 < ${TODAY}) as d1_eligible,
      count(*) filter (where day0 + 1 < ${TODAY} and d1) as d1,
      count(*) filter (where day0 + 7 < ${TODAY}) as d7_eligible,
      count(*) filter (where day0 + 7 < ${TODAY} and d7) as d7,
      (select count(*) from n where n.p->>'s' = 'share') as share_new,
      (select count(*) from ${GK} s where s.name = 'gk_share' and ${IN_RANGE('s.created_at')}) as shares
    from has`,

  // ---------------------------------------------------------------- acquisition
  channels: `
    with f as (${FIRSTS}),
         n as (select *, ${GK_CHANNEL} as channel from f where first_at > now() - $1::interval)
    select channel, count(*) as players,
      count(*) filter (where exists (select 1 from ${GK} g where g.user_id = n.user_id and g.${PLAYED})) as played,
      count(*) filter (where n.day0 + 1 < ${TODAY}) as d1_eligible,
      count(*) filter (where n.day0 + 1 < ${TODAY} and exists (select 1 from ${GK} r
                         where r.user_id = n.user_id and ${DAY('r.created_at')} = n.day0 + 1)) as d1
    from n group by channel order by players desc`,

  // Cafe QR codes: every scan, not just first visits (a regular scanning again still counts)
  cafes: `
    select coalesce(nullif(props->>'utm_campaign', ''), '?') as cafe, props->>'game' as site,
      count(*) as scans, count(*) filter (where ${FIRST_OPEN('e')}) as new_players,
      count(distinct user_id) filter (where exists (select 1 from ${GK} g where g.user_id = e.user_id and g.${PLAYED})) as played,
      to_char(max(created_at) at time zone '${TZ}', 'DD Mon HH24:MI') as last_scan
    from ${GK} e where name = 'gk_open' and props->>'utm_source' = 'cafe' and ${IN_RANGE('created_at')}
    group by 1, 2 order by scans desc`,

  campaigns: `
    with f as (${FIRSTS})
    select coalesce(nullif(p->>'utm_campaign', ''), p->>'utm_source') as campaign, coalesce(p->>'utm_source', '') as source,
      coalesce(p->>'utm_medium', '') as medium, count(*) as players
    from f where first_at > now() - $1::interval and (coalesce(p->>'utm_source', '') <> '' or coalesce(p->>'utm_campaign', '') <> '')
    group by 1, 2, 3 order by 4 desc limit 20`,

  referrers: `
    select coalesce(nullif(props->>'referrer', ''), '(direct / app)') as label, count(distinct user_id) as players
    from ${GK} e0 where name = 'gk_open' and ${IN_RANGE('created_at')}
    group by 1 order by 2 desc limit 12`,

  // ---------------------------------------------------------------- activation
  activation: `
    with f as (${FIRSTS}),
         n as (select user_id, first_at, day0 from f where first_at > now() - $1::interval),
         has as (select n.user_id, n.first_at, n.day0,
           bool_or(e.name = 'gk_start') as started,
           bool_or(e.name = 'gk_finish') as finished,
           count(*) filter (where e.name = 'gk_finish') as finishes,
           bool_or(e.name = 'gk_share') as shared,
           bool_or(e.name in ('gk_room_create', 'gk_room_join')) as roomed,
           bool_or(${DAY('e.created_at')} = n.day0 + 1) as back_d1,
           min(e.created_at) filter (where e.name = 'gk_finish') as first_finish_at
         from n left join ${GK} e on e.user_id = n.user_id group by n.user_id, n.first_at, n.day0)
    select count(*) as opened,
      count(*) filter (where started) as started,
      count(*) filter (where finished) as finished,
      count(*) filter (where finishes >= 2) as second,
      count(*) filter (where shared) as shared,
      count(*) filter (where roomed) as roomed,
      count(*) filter (where day0 + 1 < ${TODAY}) as d1_eligible,
      count(*) filter (where day0 + 1 < ${TODAY} and back_d1) as back_d1,
      round(percentile_cont(0.5) within group (order by extract(epoch from first_finish_at - first_at) / 60)::numeric, 1) as median_min_to_finish
    from has`,

  // ---------------------------------------------------------------- retention
  cohorts: `
    with f as (select user_id, min(${DAY('created_at')}) as day0 from ${GK} f0 where name = 'gk_open' group by user_id),
         act as (select distinct user_id, ${DAY('created_at')} as day from ${GK} a0)
    select f.day0 as day, count(*) as new_players,
      ${[1, 3, 7, 14, 30].map(n => `case when f.day0 + ${n} < ${TODAY} then count(*) filter (where exists (select 1 from act a where a.user_id = f.user_id and a.day = f.day0 + ${n})) end as d${n}`).join(',\n      ')}
    from f where f.day0 > ${TODAY} - greatest(least(ceil(extract(epoch from $1::interval) / 86400)::int, 30), 14)
    group by f.day0 order by f.day0 desc`,

  cohortsWeekly: `
    with f as (select user_id, min(${DAY('created_at')}) as day0 from ${GK} f0 where name = 'gk_open' group by user_id),
         act as (select distinct user_id, ${DAY('created_at')} as day from ${GK} a0),
         w as (select user_id, date_trunc('week', day0)::date as week from f)
    select w.week, count(*) as new_players,
      ${[1, 2, 3, 4, 8].map(k => `case when w.week + ${7 * k + 6} < ${TODAY} then count(*) filter (where exists (select 1 from act a where a.user_id = w.user_id and a.day between w.week + ${7 * k} and w.week + ${7 * k + 6})) end as w${k}`).join(',\n      ')}
    from w where w.week > ${TODAY} - 7 * 12
    group by w.week order by w.week desc`,

  churn: `
    with act as (select distinct user_id, ${DAY('created_at')} as day from ${GK} a0 where created_at > now() - interval '60 days'),
         lastwk as (select distinct user_id from act where day between ${TODAY} - 13 and ${TODAY} - 7),
         thiswk as (select distinct user_id from act where day > ${TODAY} - 7)
    select (select count(*) from lastwk) as last_week,
           (select count(*) from lastwk where user_id in (select user_id from thiswk)) as kept`,

  // ---------------------------------------------------------------- engagement
  sessionLengths: `
    with s as (select session_id, sum((props->>'seconds')::numeric) as secs from ${GK} e0
               where name = 'gk_time' and ${IN_RANGE('created_at')} group by session_id)
    select case when secs < 30 then '< 30s' when secs < 60 then '30s–1m' when secs < 180 then '1–3m'
                when secs < 600 then '3–10m' when secs < 1800 then '10–30m' else '30m+' end as label,
           min(secs) as o, count(*) as sessions
    from s group by 1 order by o`,

  // Live daily streaks: each player's latest daily finish, if it was today or yesterday
  streaks: `
    with last as (select distinct on (user_id, props->>'game') user_id, props->>'game' as site, (props->>'streak')::int as streak, created_at
                  from ${GK} e0 where name = 'gk_finish' and props->>'mode' = 'daily' and props ? 'streak'
                  order by user_id, props->>'game', created_at desc)
    select site, case when streak <= 1 then '1' when streak <= 3 then '2–3' when streak <= 6 then '4–6'
                      when streak <= 13 then '7–13' when streak <= 29 then '14–29' else '30+' end as label,
           min(streak) as o, count(*) as players
    from last where ${DAY('created_at')} >= ${TODAY} - 1
    group by 1, 2 order by 1, o`,

  // ---------------------------------------------------------------- per game
  games: `
    select props->>'game' as site,
      count(distinct user_id) as players,
      count(distinct user_id) filter (where name in ('gk_start', 'gk_finish')) as gamers,
      count(*) filter (where name = 'gk_start') as starts,
      count(*) filter (where name = 'gk_finish') as finishes,
      count(*) filter (where name = 'gk_share') as shares,
      count(*) filter (where name = 'gk_room_create') as rooms,
      count(*) filter (where name = 'gk_room_join') as joins,
      count(*) filter (where name = 'gk_error') as errors,
      round(sum((props->>'seconds')::numeric) filter (where name = 'gk_time')
            / nullif(count(distinct session_id) filter (where name = 'gk_time'), 0)) as avg_sec
    from ${GK} e0 where ${IN_RANGE('created_at')}
    group by 1 order by players desc`,

  // Hatke: each daily, how it went
  hatkeDays: `
    select (props->>'n')::int as n, count(distinct user_id) as players,
      round(avg((props->>'pts')::numeric)) as avg_pts, round(avg((props->>'ft')::numeric)) as avg_ft,
      max((props->>'pts')::int) as best,
      ${['s', 'a', 't', 'h', 'l', '-'].map(t => `sum(length(props->>'tiers') - length(replace(props->>'tiers', '${t}', ''))) as t_${t === '-' ? 'miss' : t}`).join(', ')}
    from ${GK} e0 where name = 'gk_finish' and props->>'game' = 'hatke' and props->>'mode' = 'daily' and ${IN_RANGE('created_at')}
    group by 1 order by 1 desc`,

  // Hatke: what players say, per prompt (the data for real rarity)
  hatkePrompts: `
    with a as (select props->>'prompt' as prompt, lower(trim(props->>'said')) as said, props->>'tier' as tier, props->>'miss' as miss
               from ${GK} e0 where name = 'gk_answer' and props->>'game' = 'hatke' and ${IN_RANGE('created_at')}),
         tops as (select prompt, said, count(*) as c, row_number() over (partition by prompt order by count(*) desc) as rk
                  from a where said <> '' group by 1, 2)
    select a.prompt, count(*) as rounds,
      count(*) filter (where a.tier is not null) as found,
      count(*) filter (where a.miss = 'timeout') as timeouts,
      count(*) filter (where a.miss = 'skip') as skips,
      count(*) filter (where a.tier in ('h', 'l')) as rare,
      (select string_agg(t.said || ' ' || t.c, ' · ' order by t.rk) from tops t where t.prompt = a.prompt and t.rk <= 6) as top_answers
    from a group by a.prompt order by rounds desc limit 60`,

  // Hatke: answers the bank doesn't know, most-tried first (add them, or add a zinger)
  hatkeMisses: `
    select props->>'prompt' as prompt, lower(trim(props->>'said')) as said, count(*) as tries,
      count(distinct user_id) as players, bool_or((props->>'zinger')::boolean) as zinger
    from ${GK} e0 where name = 'gk_miss' and props->>'game' = 'hatke' and ${IN_RANGE('created_at')}
    group by 1, 2 order by tries desc, players desc limit 80`,

  // Tatva: each daily, how hard it was
  tatvaDays: `
    select (props->>'n')::int as n, count(distinct user_id) as players,
      round(100.0 * count(*) filter (where (props->>'won')::boolean) / nullif(count(*), 0)) as win_pct,
      round(avg((props->>'darts')::numeric) filter (where (props->>'won')::boolean), 1) as avg_darts,
      round(100.0 * count(*) filter (where coalesce(props->>'lifelines', '') <> '') / nullif(count(*), 0)) as lifeline_pct
    from ${GK} e0 where name = 'gk_finish' and props->>'game' = 'tatva' and props->>'mode' = 'daily' and ${IN_RANGE('created_at')}
    group by 1 order by 1 desc`,

  tatvaDarts: `
    select case when (props->>'won')::boolean then props->>'darts' else 'X' end as label,
      case when (props->>'won')::boolean then (props->>'darts')::int else 99 end as o, count(*) as games
    from ${GK} e0 where name = 'gk_finish' and props->>'game' = 'tatva' and ${IN_RANGE('created_at')}
    group by 1, 2 order by o`,

  // Room games: how people play them. Since 2026.10.17 every phone in a game sends its own gk_start and
  // gk_finish with the room and game number; before that only the tap on Start was counted (no 'no').
  rooms: `
    select props->>'game' as site,
      count(*) filter (where name = 'gk_room_create') as created,
      count(*) filter (where name = 'gk_room_join') as joined,
      count(distinct (props->>'room') || ':' || (props->>'no')) filter (where name = 'gk_start' and props->>'mode' = 'room' and props ? 'no')
        + count(*) filter (where name = 'gk_start' and props->>'mode' = 'room' and not props ? 'no') as room_games,
      round(count(*) filter (where name = 'gk_start' and props->>'mode' = 'room' and props ? 'no')::numeric
        / nullif(count(distinct (props->>'room') || ':' || (props->>'no')) filter (where name = 'gk_start' and props->>'mode' = 'room' and props ? 'no'), 0), 1) as per_game,
      count(distinct (props->>'room') || ':' || (props->>'no')) filter (where name = 'gk_finish' and props->>'mode' = 'room') as room_finished,
      count(*) filter (where name = 'gk_start' and props->>'mode' <> 'room') as solo_starts,
      count(*) filter (where name = 'gk_finish' and props->>'mode' <> 'room') as solo_finished,
      count(*) filter (where name = 'gk_mode' and props->>'opp' in ('dadi', 'chintu')) as vs_computer,
      count(*) filter (where name = 'gk_mode' and props->>'opp' = 'dost') as same_phone,
      count(*) filter (where name = 'gk_mode' and props->>'opp' = 'room') as room_mode
    from ${GK} e0 where props->>'game' in ('tictacchai', 'cricket', 'pataakha', 'dahi') and ${IN_RANGE('created_at')}
    group by 1 order by 2 desc`,

  // ---------------------------------------------------------------- hub and sharing
  hub: `
    select
      (select count(distinct user_id) from ${GK} h where h.props->>'game' = 'hub' and h.name = 'gk_open' and ${IN_RANGE('h.created_at')}) as visitors,
      (select count(distinct user_id) from ${GK} h where h.name = 'gk_click' and ${IN_RANGE('h.created_at')}) as clickers`,
  hubClicks: `
    select props->>'to' as label, props->>'from' as place, count(*) as clicks, count(distinct user_id) as players
    from ${GK} e0 where name = 'gk_click' and ${IN_RANGE('created_at')}
    group by 1, 2 order by 3 desc`,

  sharing: `
    select props->>'game' as site,
      count(*) filter (where name = 'gk_share') as shares,
      count(distinct user_id) filter (where name = 'gk_share') as sharers,
      count(*) filter (where name = 'gk_open' and props->>'s' = 'share') as arrivals,
      count(*) filter (where name = 'gk_open' and props->>'s' = 'share' and ${FIRST_OPEN('e0')}) as new_players
    from ${GK} e0 where ${IN_RANGE('created_at')}
    group by 1 order by 2 desc, 4 desc`,

  // ---------------------------------------------------------------- tech
  devices: `select coalesce(context->>'device', '(unknown)') as label, count(distinct user_id) as players from ${GK} e0 where ${IN_RANGE('created_at')} group by 1 order by 2 desc`,
  os: `select coalesce(context->>'os', '(unknown)') as label, count(distinct user_id) as players from ${GK} e0 where ${IN_RANGE('created_at')} group by 1 order by 2 desc`,
  browsers: `select coalesce(context->>'browser', '(unknown)') as label, count(distinct user_id) as players from ${GK} e0 where ${IN_RANGE('created_at')} group by 1 order by 2 desc`,
  langs: `select coalesce(nullif(context->>'lang', ''), '(unknown)') as label, count(distinct user_id) as players from ${GK} e0 where ${IN_RANGE('created_at')} group by 1 order by 2 desc limit 10`,
  installed: `
    select count(distinct user_id) filter (where (context->>'standalone')::boolean) as installed, count(distinct user_id) as players
    from ${GK} e0 where name = 'gk_open' and ${IN_RANGE('created_at')}`,
  loadTimes: `
    select props->>'game' as site, coalesce(context->>'device', '(unknown)') as device, count(*) as loads,
      round(percentile_cont(0.5) within group (order by (props->>'ms')::numeric)) as p50,
      round(percentile_cont(0.9) within group (order by (props->>'ms')::numeric)) as p90
    from ${GK} e0 where name = 'gk_load' and ${IN_RANGE('created_at')}
    group by 1, 2 order by 3 desc`,
  errors: `
    select props->>'game' as site, props->>'msg' as msg, props->>'src' as src, max((props->>'line')::int) as line,
      count(*) as times, count(distinct user_id) as players,
      string_agg(distinct coalesce(context->>'os', '?') || '/' || coalesce(context->>'browser', '?'), ', ') as where_seen,
      to_char(max(created_at) at time zone '${TZ}', 'DD Mon HH24:MI') as last_seen
    from ${GK} e0 where name = 'gk_error' and ${IN_RANGE('created_at')}
    group by 1, 2, 3 order by times desc limit 50`,

  // ---------------------------------------------------------------- live
  recent: `
    select to_char(created_at at time zone '${TZ}', 'DD Mon HH24:MI:SS') as time, left(user_id::text, 8) as player,
      props->>'game' as site, name, (props - 'game')::text as details, context->>'device' as device, context->>'os' as os
    from ${GK} e0 order by created_at desc limit 200`,
};

// One player's timeline, by the start of their id ($3)
export const GK_PLAYER = {
  events: `
    select to_char(created_at at time zone '${TZ}', 'DD Mon HH24:MI:SS') as time, props->>'game' as site, name,
      (props - 'game')::text as details, context->>'device' as device
    from ${GK} e0 where user_id::text like $3::text || '%' order by created_at desc limit 300`,
};
