-- 017_push.sql — push notifications (Web Push: Android, desktop, iPhone home-screen app).
-- Run after 016_night_presence.sql. Safe to re-run. Setup steps: docs/PUSH.md.
--
-- How it fits together
--   · The app saves each device's push subscription (push_save) and the player's
--     choices (push_set_prefs). Nothing is sent until the player turns it on.
--   · Every minute pg_cron calls the `push` Edge Function, which asks push_due()
--     what to send right now, sends it, and reports back (push_report).
--   · push_due() decides, per device, in the player's own time zone:
--       daily     at their reminder time (default 7 PM) if today's Daily isn't played
--       streak    before the Daily resets (00:00 UTC), if a 2+ day streak is about to end
--       comeback  3, 7 and 14 days after they last played, at their reminder time
--       queued    friend requests, new room challenges, game nights (from triggers below)
--     At most one reminder-type push per device per run; daily/comeback once a local day,
--     streak once a UTC day; nothing between 22:00 and 08:00 except their chosen time.

-- ============================================================
-- Tables (no policies: everything goes through the functions below)
-- ============================================================
create table if not exists public.push_config (
  id           int primary key default 1 check (id = 1),
  vapid_public text not null check (vapid_public ~ '^[A-Za-z0-9_-]{80,100}$')
);
alter table public.push_config enable row level security;

create table if not exists public.push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users on delete cascade,
  endpoint        text not null unique check (endpoint ~ '^https://' and length(endpoint) < 1000),
  p256dh          text not null check (p256dh ~ '^[A-Za-z0-9_-]{80,100}$'),
  auth            text not null check (auth ~ '^[A-Za-z0-9_-]{16,30}$'),
  platform        text not null default 'web' check (platform ~ '^[a-z-]{2,20}$'),
  created_at      timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  last_ok_at      timestamptz,
  failures        int not null default 0,
  last_daily_on   date,          -- the player's local date of the last daily reminder
  last_comeback_on date,         -- … of the last come-back nudge
  last_streak_day date           -- the UTC Daily the last streak warning was about
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;

create table if not exists public.push_prefs (
  user_id    uuid primary key references auth.users on delete cascade,
  tz         text not null default 'UTC',
  remind_at  time not null default '19:00',
  daily      boolean not null default true,
  streak     boolean not null default true,
  social     boolean not null default true,
  comeback   boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.push_prefs enable row level security;

-- Event-driven pushes (friend requests, challenges, game nights, tests)
create table if not exists public.push_queue (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users on delete cascade,
  kind       text not null check (kind in ('friend', 'challenge', 'night', 'test')),
  payload    jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '12 hours',
  sent_at    timestamptz
);
create index if not exists push_queue_pending_idx on public.push_queue (created_at) where sent_at is null;
alter table public.push_queue enable row level security;

-- One row per push sent, for the dashboard (kept 90 days)
create table if not exists public.push_log (
  id         bigint generated always as identity primary key,
  user_id    uuid,
  kind       text not null,
  platform   text,
  ok         boolean not null,
  status     int,
  created_at timestamptz not null default now()
);
create index if not exists push_log_time_idx on public.push_log (created_at);
alter table public.push_log enable row level security;

-- ============================================================
-- For the app
-- ============================================================
-- The public half of the VAPID key pair (null until push is set up)
create or replace function public.push_public_key()
returns text language sql stable security definer set search_path = '' as $$
  select vapid_public from public.push_config where id = 1;
$$;

-- Save this device's subscription (and the player's time zone)
create or replace function public.push_save(p_endpoint text, p_p256dh text, p_auth text, p_tz text, p_platform text default 'web')
returns void language plpgsql security definer set search_path = '' as $$
declare v_tz text := case when exists (select 1 from pg_catalog.pg_timezone_names where name = p_tz) then p_tz else 'UTC' end;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, platform)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, coalesce(nullif(p_platform, ''), 'web'))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        platform = excluded.platform, last_seen_at = now(), failures = 0;
  insert into public.push_prefs (user_id, tz) values (auth.uid(), v_tz)
  on conflict (user_id) do update set tz = v_tz, updated_at = now();
  -- a player has at most 10 devices: drop the stalest
  delete from public.push_subscriptions where id in (
    select id from public.push_subscriptions where user_id = auth.uid() order by last_seen_at desc offset 10);
end $$;

create or replace function public.push_remove(p_endpoint text)
returns void language sql security definer set search_path = '' as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;

create or replace function public.push_prefs_get()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'remind_at', to_char(coalesce(p.remind_at, '19:00'), 'HH24:MI'),
    'daily', coalesce(p.daily, true), 'streak', coalesce(p.streak, true),
    'social', coalesce(p.social, true), 'comeback', coalesce(p.comeback, true),
    'devices', (select count(*) from public.push_subscriptions s where s.user_id = auth.uid()))
  from (select 1) one left join public.push_prefs p on p.user_id = auth.uid();
$$;

create or replace function public.push_prefs_set(p jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.push_prefs (user_id) values (auth.uid()) on conflict do nothing;
  update public.push_prefs set
    remind_at = case when p ? 'remind_at' and (p->>'remind_at') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then (p->>'remind_at')::time else remind_at end,
    daily    = coalesce((p->>'daily')::boolean, daily),
    streak   = coalesce((p->>'streak')::boolean, streak),
    social   = coalesce((p->>'social')::boolean, social),
    comeback = coalesce((p->>'comeback')::boolean, comeback),
    updated_at = now()
  where user_id = auth.uid();
end $$;

-- "Send me a test": queued for this player's devices, sent within a minute
create or replace function public.push_test()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if exists (select 1 from public.push_queue where user_id = auth.uid() and kind = 'test' and created_at > now() - interval '30 seconds') then
    raise exception 'slow down';
  end if;
  insert into public.push_queue (user_id, kind, payload, expires_at) values (auth.uid(), 'test',
    jsonb_build_object('title', 'Reminders are on ✅', 'body', 'This is what a Borderline nudge looks like. See you at the next Daily!',
                       'url', './?s=push&n=test', 'tag', 'test'), now() + interval '10 minutes');
end $$;

-- ============================================================
-- Social pushes, queued by triggers
-- ============================================================
create or replace function public._push_friend_request()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_name text := (select username from public.profiles where id = new.from_id);
begin
  if v_name is null then return new; end if;
  insert into public.push_queue (user_id, kind, payload, expires_at) values (new.to_id, 'friend',
    jsonb_build_object('title', v_name || ' wants to be friends 👋', 'body', 'Accept and race each other on every Daily.',
                       'url', './?s=push&n=friend&go=friends', 'tag', 'friend-' || new.from_id), now() + interval '24 hours');
  return new;
end $$;
drop trigger if exists push_friend_request on public.friend_requests;
create trigger push_friend_request after insert on public.friend_requests
  for each row execute function public._push_friend_request();

create or replace function public._push_night()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r public.rooms; v_name text;
begin
  select * into r from public.rooms where id = new.room_id;
  v_name := coalesce((select username from public.profiles where id = new.host_id), 'Someone');
  insert into public.push_queue (user_id, kind, payload, expires_at)
  select m.user_id, 'night',
    jsonb_build_object('title', '🔴 Game night in ' || r.name, 'body', v_name || ' just started one. Jump in before round 1!',
                       'url', './?s=push&n=night&go=room:' || r.id, 'tag', 'night-' || r.id, 'renotify', true),
    now() + interval '20 minutes'
  from public.room_members m where m.room_id = new.room_id and m.user_id <> new.host_id;
  return new;
end $$;
drop trigger if exists push_night on public.room_nights;
create trigger push_night after insert on public.room_nights
  for each row execute function public._push_night();

create or replace function public._push_challenge()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r public.rooms; v_name text; v_where text;
begin
  select * into r from public.rooms where id = new.room_id;
  v_name := coalesce((select username from public.profiles where id = new.creator_id), 'Someone');
  v_where := case new.theme when 'world' then 'around the world' when 'americas' then 'in the Americas'
                            else 'in ' || initcap(new.theme) end;
  insert into public.push_queue (user_id, kind, payload, expires_at)
  select m.user_id, 'challenge',
    jsonb_build_object('title', '⚔️ New challenge in ' || r.name,
                       'body', v_name || ' picked 5 countries ' || v_where || case when new.speed then '. 60 seconds each.' else '. Open for 24 hours.' end,
                       'url', './?s=push&n=challenge&go=room:' || r.id, 'tag', 'challenge-' || new.id),
    now() + interval '12 hours'
  from public.room_members m where m.room_id = new.room_id and m.user_id <> new.creator_id;
  return new;
end $$;
drop trigger if exists push_challenge on public.room_challenges;
create trigger push_challenge after insert on public.room_challenges
  for each row execute function public._push_challenge();

-- ============================================================
-- For the Edge Function (service role only)
-- ============================================================
-- Everything to send right now: [{ sub, endpoint, p256dh, auth, kind, payload }]
-- Claims what it returns (guards and queue rows are updated), so a second
-- overlapping run doesn't send it again. p_now is for tests.
create or replace function public.push_due(p_now timestamptz default now(), p_limit int default 500)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_out jsonb; v_day date := (p_now at time zone 'utc')::date; v_n int;
begin
  if not pg_try_advisory_xact_lock(711017) then return '[]'::jsonb; end if;
  v_n := (v_day - date '2026-09-27') + 1;   -- Daily number (store.js DAILY_EPOCH)

  create temp table _due on commit drop as
  with s as (
    select s.*, coalesce(p.tz, 'UTC') as tz, coalesce(p.remind_at, '19:00') as remind_at,
           coalesce(p.daily, true) as p_daily, coalesce(p.streak, true) as p_streak,
           coalesce(p.comeback, true) as p_comeback
    from public.push_subscriptions s left join public.push_prefs p on p.user_id = s.user_id
    where s.failures < 5
  ),
  t as (
    select s.*,
      (p_now at time zone s.tz) as local_now,
      (p_now at time zone s.tz)::date as local_date,
      (p_now at time zone s.tz)::time as local_time,
      exists (select 1 from public.daily_scores d where d.user_id = s.user_id and d.day = v_day) as played,
      (select max(e.created_at) from public.events e where e.user_id = s.user_id) as last_active,
      (select count(*) from (
         select d.day, d.day + (row_number() over (order by d.day desc))::int as k
         from public.daily_scores d where d.user_id = s.user_id and d.day <= v_day) x
       where x.k = (select max(day) + 1 from public.daily_scores d2 where d2.user_id = s.user_id and d2.day <= v_day)
         and (select max(day) from public.daily_scores d3 where d3.user_id = s.user_id and d3.day <= v_day) >= v_day - 1
      ) as streak
    from s
  ),
  u as (
    select t.*,
      (t.local_date - (coalesce(t.last_active, t.created_at) at time zone t.tz)::date) as idle_days,
      -- the Daily resets at 00:00 UTC; when is that for this player?
      ((v_day + 1)::timestamp at time zone 'utc') as deadline,
      (((v_day + 1)::timestamp at time zone 'utc') at time zone t.tz) as local_deadline,
      t.local_time >= t.remind_at and t.local_time < t.remind_at + interval '1 hour' as at_remind_time
    from t
  ),
  c as (
    select u.*,
      -- streak warning: 3 hours before the reset when that's daytime for them, else 9 PM the evening before
      case when extract(hour from u.local_deadline) between 12 and 23
           then u.local_deadline - interval '3 hours'
           else (u.local_deadline::date - case when extract(hour from u.local_deadline) < 12 then 1 else 0 end) + time '21:00' end as streak_at
    from u
  ),
  pick as (
    select c.id as sub, c.user_id, c.platform, c.endpoint, c.p256dh, c.auth,
      case
        when c.p_streak and not c.played and c.streak >= 2 and c.last_streak_day is distinct from v_day
             and c.local_now >= c.streak_at and p_now < c.deadline - interval '20 minutes'
             and extract(hour from c.local_now) between 8 and 22 then 'streak'
        when c.p_daily and not c.played and c.idle_days < 3 and c.at_remind_time
             and c.last_daily_on is distinct from c.local_date then 'daily'
        when c.p_comeback and not c.played and c.idle_days in (3, 7, 14) and c.at_remind_time
             and c.last_comeback_on is distinct from c.local_date then 'comeback'
      end as kind,
      c.streak, c.idle_days, c.deadline, c.local_date
    from c
  )
  select * from pick where kind is not null limit p_limit;

  -- claim reminders
  update public.push_subscriptions s set
    last_daily_on    = case when d.kind = 'daily' then d.local_date else s.last_daily_on end,
    last_comeback_on = case when d.kind = 'comeback' then d.local_date else s.last_comeback_on end,
    last_streak_day  = case when d.kind = 'streak' then v_day else s.last_streak_day end
  from _due d where d.sub = s.id;

  with words as (
    select d.*,
      abs(hashtext(d.user_id::text || v_day)) % 3 as v,
      (select cc.continent from public.daily_answers a join public.country_continents cc on cc.country = a.country
        where a.day = v_day) as continent,
      greatest(1, ceil(extract(epoch from (d.deadline - p_now)) / 3600))::int as hours_left
    from _due d
  ),
  reminders as (
    select w.sub, w.endpoint, w.p256dh, w.auth, w.kind, w.platform, w.user_id,
      case w.kind
        when 'daily' then case
          when w.streak >= 2 then jsonb_build_object('title', '🔥 ' || w.streak || '-day streak · Daily #' || v_n || ' is live',
                                                     'body', 'A new mystery country is waiting. Keep the streak going.')
          when w.v = 0 then jsonb_build_object('title', 'Daily #' || v_n || ' is live 🌍', 'body', 'One mystery country. 10 guesses. Can you find it?')
          when w.v = 1 then jsonb_build_object('title', 'A new mystery country just dropped', 'body', 'Daily #' || v_n || ' takes about 2 minutes. Beat your best?')
          else jsonb_build_object('title', 'Where in the world is it today? 🧭', 'body', 'Daily #' || v_n || ' is waiting for you.') end
        when 'streak' then jsonb_build_object('title', '🔥 Your ' || w.streak || '-day streak ends in ' || w.hours_left || ' hour' || case when w.hours_left = 1 then '' else 's' end,
                                              'body', 'Daily #' || v_n || ' takes about 2 minutes. Don’t let it go!', 'renotify', true)
        when 'comeback' then case
          when w.idle_days = 3 then jsonb_build_object('title', 'The globe misses you 🌍',
            'body', coalesce('Today’s mystery country is in ' || w.continent || '. Think you can find it?', 'A new mystery country every day. Takes 2 minutes.'))
          when w.idle_days = 7 then jsonb_build_object('title', 'Daily #' || v_n || ': a country in ' || coalesce(w.continent, 'a corner of the world'),
            'body', 'It’s been a week. Jump back in, it takes 2 minutes.')
          else jsonb_build_object('title', 'Still got it? 🧭', 'body', coalesce('Today’s mystery is in ' || w.continent || '. Find it in under 5 guesses.', 'Find today’s mystery country in under 5 guesses.')) end
      end || jsonb_build_object('url', './?s=push&n=' || w.kind || '&go=daily', 'tag', 'daily') as payload
    from words w
  ),
  -- queued pushes wait out the night (08:00–22:00 local) unless they're live (game nights) or tests
  queued as (
    update public.push_queue q set sent_at = p_now
    where q.id in (
      select q2.id from public.push_queue q2 left join public.push_prefs p2 on p2.user_id = q2.user_id
      where q2.sent_at is null
        and (q2.expires_at <= p_now or q2.kind in ('test', 'night')
             or extract(hour from (p_now at time zone coalesce(p2.tz, 'UTC'))) between 8 and 21)
      order by q2.created_at limit p_limit for update of q2 skip locked)
    returning q.*
  ),
  social as (
    select s.id as sub, s.endpoint, s.p256dh, s.auth, q.kind, s.platform, s.user_id, q.payload
    from queued q
    join public.push_subscriptions s on s.user_id = q.user_id and s.failures < 5
    left join public.push_prefs p on p.user_id = q.user_id
    where q.expires_at > p_now
      and (q.kind = 'test' or coalesce(p.social, true))
  )
  select coalesce(jsonb_agg(jsonb_build_object('sub', x.sub, 'endpoint', x.endpoint, 'p256dh', x.p256dh, 'auth', x.auth,
                                               'kind', x.kind, 'payload', x.payload)), '[]'::jsonb)
  into v_out
  from (select * from reminders union all select * from social) x;
  return v_out;
end $$;

-- Results from the Edge Function: [{ sub, kind, status }]
-- 2xx: delivered to the push service. 404/410: the device unsubscribed, forget it.
create or replace function public.push_report(p jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.push_log (user_id, kind, platform, ok, status)
  select s.user_id, r->>'kind', s.platform, (r->>'status')::int between 200 and 299, (r->>'status')::int
  from jsonb_array_elements(p) r left join public.push_subscriptions s on s.id = (r->>'sub')::uuid;

  update public.push_subscriptions s set
    last_ok_at = case when (r->>'status')::int between 200 and 299 then now() else s.last_ok_at end,
    failures   = case when (r->>'status')::int between 200 and 299 then 0 else s.failures + 1 end
  from jsonb_array_elements(p) r where s.id = (r->>'sub')::uuid;

  delete from public.push_subscriptions s using jsonb_array_elements(p) r
  where s.id = (r->>'sub')::uuid and ((r->>'status')::int in (404, 410) or s.failures >= 5);

  delete from public.push_log where created_at < now() - interval '90 days';
  delete from public.push_queue where created_at < now() - interval '3 days';
end $$;

-- ============================================================
-- Permissions
-- ============================================================
do $$
declare f text;
begin
  foreach f in array array['push_public_key()', 'push_save(text, text, text, text, text)', 'push_remove(text)',
                           'push_prefs_get()', 'push_prefs_set(jsonb)', 'push_test()']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['push_due(timestamptz, int)', 'push_report(jsonb)',
                           '_push_friend_request()', '_push_night()', '_push_challenge()']
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  execute 'grant execute on function public.push_due(timestamptz, int) to service_role';
  execute 'grant execute on function public.push_report(jsonb) to service_role';
end $$;
