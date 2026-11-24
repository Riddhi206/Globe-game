-- 011_rooms_hub.sql — "Play with friends": rooms for everyone, room emoji,
-- 5-country room challenges and a room activity feed.
-- Run after 010_rooms_keys.sql, then run 012_country_continents.sql. Safe to re-run.

-- ============================================================
-- Rooms: an emoji each
-- ============================================================
alter table public.rooms add column if not exists emoji text not null default '🌍'
  check (char_length(emoji) between 1 and 8);

-- ============================================================
-- Countries by continent, for themed challenges (rows: 012_country_continents.sql)
-- ============================================================
create table if not exists public.country_continents (
  country   text primary key,
  continent text not null check (continent in ('Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania'))
);
alter table public.country_continents enable row level security;   -- no policies: read through the functions below

-- ============================================================
-- Room challenges: 5 countries picked by the server, open 24 hours.
-- Each round starts on the server's clock and is scored there.
-- ============================================================
create table if not exists public.room_challenges (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms on delete cascade,
  creator_id uuid not null references auth.users on delete cascade,
  theme      text not null check (theme in ('world', 'europe', 'asia', 'africa', 'americas', 'oceania')),
  speed      boolean not null default false,
  countries  text[] not null check (array_length(countries, 1) = 5),
  rematch_of uuid references public.room_challenges on delete set null,
  created_at timestamptz not null default now(),
  ends_at    timestamptz not null default now() + interval '24 hours'
);
create index if not exists room_challenges_room_idx on public.room_challenges (room_id, created_at desc);
alter table public.room_challenges enable row level security;

create table if not exists public.challenge_results (
  challenge_id uuid not null references public.room_challenges on delete cascade,
  user_id      uuid not null references auth.users on delete cascade,
  round        int  not null check (round between 1 and 5),
  started_at   timestamptz not null default now(),
  submitted_at timestamptz,
  found        boolean,
  guess_count  int,
  seconds      int,
  points       int,
  primary key (challenge_id, user_id, round)
);
alter table public.challenge_results enable row level security;

-- Relaxed: 10 guesses a country. Speed: 60 seconds a country.
create or replace function public._challenge_open(c public.room_challenges)
returns boolean language sql stable set search_path = '' as $$
  select now() < c.ends_at;
$$;

-- ============================================================
-- Creating rooms: anyone with a leaderboard name, 3 of their own
-- (20 for admins and managers). Joining: up to 10 rooms.
-- ============================================================
drop function if exists public.create_room(text);
create or replace function public.create_room(p_name text, p_emoji text default '🌍')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_code text; v_id uuid; v_name text := btrim(p_name); v_emoji text := coalesce(nullif(btrim(p_emoji), ''), '🌍');
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if public._my_username() is null then raise exception 'pick a name first'; end if;
  if char_length(v_name) not between 2 and 40 then raise exception 'room name must be 2-40 characters'; end if;
  if char_length(v_emoji) > 8 then v_emoji := '🌍'; end if;
  if (select count(*) from public.rooms where owner_id = auth.uid() and closed_at is null)
     >= (case when public.has_feature('rooms_create') then 20 else 3 end) then
    raise exception 'too many rooms';
  end if;
  loop
    v_code := public._room_code();
    exit when not exists (select 1 from public.rooms where code = v_code);
  end loop;
  insert into public.rooms (code, name, owner_id, emoji) values (v_code, v_name, auth.uid(), v_emoji) returning id into v_id;
  insert into public.room_members (room_id, user_id) values (v_id, auth.uid());
  return jsonb_build_object('id', v_id, 'code', v_code, 'name', v_name, 'emoji', v_emoji);
end $$;

create or replace function public.join_room(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.rooms;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into r from public.rooms where code = upper(btrim(p_code));
  if r.id is null or r.closed_at is not null then raise exception 'room not found'; end if;
  if public._is_room_member(r.id) then return jsonb_build_object('id', r.id, 'name', r.name); end if;
  if public._my_username() is null then raise exception 'pick a name first'; end if;
  if (select count(*) from public.room_members where room_id = r.id) >= 50 then raise exception 'room is full'; end if;
  if not public.has_feature('rooms_create')
     and (select count(*) from public.room_members m join public.rooms x on x.id = m.room_id
          where m.user_id = auth.uid() and x.closed_at is null) >= 10 then
    raise exception 'room limit';
  end if;
  insert into public.room_members (room_id, user_id) values (r.id, auth.uid()) on conflict do nothing;
  return jsonb_build_object('id', r.id, 'name', r.name);
end $$;

create or replace function public.set_room_emoji(p_room uuid, p_emoji text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public._can_manage_room(p_room) then raise exception 'not allowed'; end if;
  if char_length(btrim(p_emoji)) not between 1 and 8 then raise exception 'bad emoji'; end if;
  update public.rooms set emoji = btrim(p_emoji) where id = p_room and closed_at is null;
end $$;

-- What an invite link shows before joining (now with the emoji)
create or replace function public.room_preview(p_code text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', r.id, 'name', r.name, 'emoji', r.emoji,
    'members', (select count(*) from public.room_members m where m.room_id = r.id),
    'full', (select count(*) from public.room_members m where m.room_id = r.id) >= 50,
    'member', public._is_room_member(r.id))
  from public.rooms r
  where r.code = upper(btrim(p_code)) and r.closed_at is null;
$$;

-- My rooms for the hub: as before, plus emoji, ownership and the open challenge
create or replace function public.my_rooms()
returns jsonb language sql stable security definer set search_path = '' as $$
  with today as (select (now() at time zone 'utc')::date as d)
  select coalesce(jsonb_agg(x order by x->>'name'), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', r.id, 'name', r.name, 'code', r.code, 'emoji', r.emoji,
      'members', (select count(*) from public.room_members m where m.room_id = r.id),
      'played_today', (select count(*) from public.room_members m join public.daily_scores s
                         on s.user_id = m.user_id and s.day = (select d from today) where m.room_id = r.id),
      'my_rank_today', (select rk from (
          select s.user_id, row_number() over (order by s.won desc, s.guess_count, s.score desc, s.created_at) as rk
          from public.room_members m join public.daily_scores s on s.user_id = m.user_id and s.day = (select d from today)
          where m.room_id = r.id) t where t.user_id = auth.uid()),
      'can_manage', r.owner_id = auth.uid() or public._is_admin(),
      'is_owner', r.owner_id = auth.uid(),
      'live_night', (select n.id from public.room_nights n
                     where n.room_id = r.id and not public._night_over(n) order by n.created_at desc limit 1),
      'challenge', (select jsonb_build_object(
          'id', c.id, 'theme', c.theme, 'speed', c.speed, 'ends_at', c.ends_at,
          'by', (select username from public.profiles where id = c.creator_id),
          'players', (select count(distinct user_id) from public.challenge_results x where x.challenge_id = c.id),
          'my_done', (select count(*) from public.challenge_results x
                      where x.challenge_id = c.id and x.user_id = auth.uid() and x.submitted_at is not null))
        from public.room_challenges c where c.room_id = r.id and public._challenge_open(c)
        order by c.created_at desc limit 1)
    ) as x
    from public.rooms r join public.room_members me on me.room_id = r.id and me.user_id = auth.uid()
    where r.closed_at is null
  ) q;
$$;

-- ============================================================
-- Challenges
-- ============================================================
create or replace function public.create_challenge(p_room uuid, p_theme text default 'world',
                                                   p_speed boolean default false, p_rematch uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_countries text[]; v_today date := (now() at time zone 'utc')::date;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from public.rooms where id = p_room and closed_at is null) then raise exception 'room not found'; end if;
  if not public._is_room_member(p_room) then raise exception 'not a member'; end if;
  if public._my_username() is null then raise exception 'pick a name first'; end if;
  if p_theme not in ('world', 'europe', 'asia', 'africa', 'americas', 'oceania') then raise exception 'bad theme'; end if;
  if (select count(*) from public.room_challenges c where c.room_id = p_room and public._challenge_open(c)) >= 3 then
    raise exception 'too many challenges';
  end if;
  if (select count(*) from public.room_challenges where creator_id = auth.uid() and created_at > now() - interval '1 day') >= 10 then
    raise exception 'slow down';
  end if;
  -- Never today's or tomorrow's Daily answer: a challenge stays open into tomorrow
  select array_agg(country) into v_countries from (
    select cc.country from public.country_continents cc
    where (p_theme = 'world'
        or (p_theme = 'europe'   and cc.continent = 'Europe')
        or (p_theme = 'asia'     and cc.continent = 'Asia')
        or (p_theme = 'africa'   and cc.continent = 'Africa')
        or (p_theme = 'americas' and cc.continent in ('North America', 'South America'))
        or (p_theme = 'oceania'  and cc.continent = 'Oceania'))
      and cc.country not in (select country from public.daily_answers where day between v_today and v_today + 1)
    order by random() limit 5) t;
  if coalesce(array_length(v_countries, 1), 0) < 5 then raise exception 'no countries left'; end if;
  insert into public.room_challenges (room_id, creator_id, theme, speed, countries, rematch_of)
  values (p_room, auth.uid(), p_theme, p_speed, v_countries, p_rematch) returning id into v_id;
  return v_id;
end $$;

-- Start (or resume) my next round. Returns the round and its country; the
-- round's clock starts here, on the server.
create or replace function public.start_challenge_round(p_challenge uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.room_challenges; v_round int; v_row public.challenge_results;
begin
  select * into c from public.room_challenges where id = p_challenge;
  if c.id is null then raise exception 'challenge not found'; end if;
  if not public._is_room_member(c.room_id) then raise exception 'not a member'; end if;
  -- an unfinished round resumes with its original clock
  select * into v_row from public.challenge_results
  where challenge_id = c.id and user_id = auth.uid() and submitted_at is null order by round limit 1;
  if v_row.round is not null then
    v_round := v_row.round;
  else
    if not public._challenge_open(c) then raise exception 'challenge is over'; end if;
    select coalesce(max(round), 0) + 1 into v_round from public.challenge_results where challenge_id = c.id and user_id = auth.uid();
    if v_round > 5 then raise exception 'already played'; end if;
    insert into public.challenge_results (challenge_id, user_id, round) values (c.id, auth.uid(), v_round)
    returning * into v_row;
  end if;
  return jsonb_build_object('round', v_round, 'country', c.countries[v_round], 'speed', c.speed,
    'started_at', (extract(epoch from v_row.started_at) * 1000)::bigint,
    'server_now', (extract(epoch from now()) * 1000)::bigint);
end $$;

-- Score a round. Found = the last guess is the country. Points: 1000 − 100 per
-- extra guess (min 100), plus up to 300 for speed. Relaxed rounds allow 10
-- guesses; speed rounds 60 seconds (+5 s for the network).
create or replace function public.submit_challenge_round(p_challenge uuid, p_round int, p_guesses text[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.room_challenges; v_row public.challenge_results; v_n int := coalesce(array_length(p_guesses, 1), 0);
        v_secs int; v_found boolean; v_points int; v_limit int;
begin
  select * into c from public.room_challenges where id = p_challenge;
  if c.id is null then raise exception 'challenge not found'; end if;
  select * into v_row from public.challenge_results where challenge_id = c.id and user_id = auth.uid() and round = p_round;
  if v_row.round is null then raise exception 'round not started'; end if;
  if v_row.submitted_at is not null then
    return jsonb_build_object('points', v_row.points, 'found', v_row.found, 'seconds', v_row.seconds, 'country', c.countries[p_round]);
  end if;
  if (select count(distinct g) from unnest(p_guesses) g) <> v_n then raise exception 'duplicate guesses'; end if;
  v_secs  := greatest(0, extract(epoch from now() - v_row.started_at)::int);
  v_limit := case when c.speed then 60 else 180 end;
  v_found := v_n > 0 and p_guesses[v_n] = c.countries[p_round]
             and (c.speed and v_secs <= 65 or not c.speed and v_n <= 10);
  v_points := case when v_found
                then greatest(100, 1000 - 100 * (v_n - 1)) + round(300 * (1 - least(v_secs, v_limit)::numeric / v_limit))::int
                else 0 end;
  update public.challenge_results
  set submitted_at = now(), found = v_found, guess_count = v_n, seconds = v_secs, points = v_points
  where challenge_id = c.id and user_id = auth.uid() and round = p_round;
  return jsonb_build_object('points', v_points, 'found', v_found, 'seconds', v_secs, 'country', c.countries[p_round]);
end $$;

-- A challenge's board. Countries stay hidden until you've played that round
-- (or the challenge is over), so nobody spoils anybody.
create or replace function public.challenge_state(p_challenge uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare c public.room_challenges; v_open boolean; v_done int;
begin
  select * into c from public.room_challenges where id = p_challenge;
  if c.id is null then raise exception 'challenge not found'; end if;
  if not (public._is_room_member(c.room_id) or public._is_admin()) then raise exception 'not a member'; end if;
  v_open := public._challenge_open(c);
  select count(*) into v_done from public.challenge_results
  where challenge_id = c.id and user_id = auth.uid() and submitted_at is not null;
  return jsonb_build_object(
    'id', c.id, 'room_id', c.room_id, 'theme', c.theme, 'speed', c.speed, 'open', v_open,
    'room_name', (select name from public.rooms where id = c.room_id),
    'room_emoji', (select emoji from public.rooms where id = c.room_id),
    'room_code', (select code from public.rooms where id = c.room_id),
    'by', (select username from public.profiles where id = c.creator_id),
    'created_at', c.created_at, 'ends_at', c.ends_at,
    'server_now', (extract(epoch from now()) * 1000)::bigint,
    'my_done', v_done,
    'mine', coalesce((select jsonb_agg(jsonb_build_object('round', x.round, 'country', c.countries[x.round],
                 'found', x.found, 'guesses', x.guess_count, 'seconds', x.seconds, 'points', x.points) order by x.round)
               from public.challenge_results x
               where x.challenge_id = c.id and x.user_id = auth.uid() and x.submitted_at is not null), '[]'::jsonb),
    'countries', case when v_done = 5 or not v_open then to_jsonb(c.countries) end,
    'board', coalesce((select jsonb_agg(row_to_json(b)::jsonb order by b.points desc, b.rounds desc, b.seconds) from (
        select p.username, x.user_id = auth.uid() as is_me,
               coalesce(sum(x.points), 0) as points,
               count(*) filter (where x.submitted_at is not null) as rounds,
               count(*) filter (where x.found) as found,
               coalesce(sum(x.seconds), 0) as seconds,
               coalesce(jsonb_agg(jsonb_build_object('round', x.round, 'found', x.found, 'points', x.points) order by x.round)
                 filter (where x.submitted_at is not null), '[]'::jsonb) as rounds_detail
        from public.challenge_results x join public.profiles p on p.id = x.user_id
        where x.challenge_id = c.id
        group by x.user_id, p.username) b), '[]'::jsonb)
  );
end $$;

-- Recent challenges in a room, newest first
create or replace function public.room_challenges(p_room uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when not (public._is_room_member(p_room) or public._is_admin()) then '[]'::jsonb else
    coalesce((select jsonb_agg(row_to_json(t)::jsonb order by t.created_at desc) from (
      select c.id, c.theme, c.speed, c.created_at, c.ends_at, public._challenge_open(c) as open,
             (select username from public.profiles where id = c.creator_id) as by,
             (select count(distinct user_id) from public.challenge_results x where x.challenge_id = c.id) as players,
             (select count(*) from public.challenge_results x where x.challenge_id = c.id and x.user_id = auth.uid() and x.submitted_at is not null) as my_done,
             (select coalesce(sum(points), 0) from public.challenge_results x where x.challenge_id = c.id and x.user_id = auth.uid()) as my_points,
             (select p.username from public.challenge_results x join public.profiles p on p.id = x.user_id
              where x.challenge_id = c.id group by p.username order by sum(x.points) desc nulls last limit 1) as leader,
             (select sum(x.points) from public.challenge_results x where x.challenge_id = c.id
              group by x.user_id order by sum(x.points) desc nulls last limit 1) as leader_points
      from public.room_challenges c where c.room_id = p_room
      order by c.created_at desc limit 10) t), '[]'::jsonb) end;
$$;

-- ============================================================
-- Activity feed: what happened in a room over the last 3 days
-- ============================================================
create or replace function public.room_feed(p_room uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with members as (
    select m.user_id, p.username, m.joined_at from public.room_members m
    join public.profiles p on p.id = m.user_id where m.room_id = p_room and p.username is not null
  ),
  ev as (
    select 'daily' as type, mb.username as who, s.created_at as at,
           jsonb_build_object('won', s.won, 'guesses', s.guess_count, 'score', s.score) as data
    from members mb join public.daily_scores s on s.user_id = mb.user_id
    where s.created_at > now() - interval '3 days'
    union all
    select 'joined', mb.username, mb.joined_at, '{}'::jsonb from members mb where mb.joined_at > now() - interval '3 days'
    union all
    select 'challenge', p.username, c.created_at, jsonb_build_object('id', c.id, 'theme', c.theme, 'speed', c.speed)
    from public.room_challenges c join public.profiles p on p.id = c.creator_id
    where c.room_id = p_room and c.created_at > now() - interval '3 days'
    union all
    select 'challenge_done', p.username, max(x.submitted_at),
           jsonb_build_object('id', c.id, 'theme', c.theme, 'points', sum(x.points))
    from public.room_challenges c join public.challenge_results x on x.challenge_id = c.id
    join public.profiles p on p.id = x.user_id
    where c.room_id = p_room and c.created_at > now() - interval '4 days'
    group by c.id, c.theme, p.username, x.user_id
    having count(x.submitted_at) = 5 and max(x.submitted_at) > now() - interval '3 days'
    union all
    select 'night', p.username, n.ended_at, jsonb_build_object('points', w.points)
    from public.room_nights n
    join lateral (select x.user_id, sum(x.points) as points from public.night_results x where x.night_id = n.id
                  group by x.user_id order by sum(x.points) desc limit 1) w on true
    join public.profiles p on p.id = w.user_id
    where n.room_id = p_room and n.ended_at > now() - interval '3 days'
  )
  select case when not (public._is_room_member(p_room) or public._is_admin()) then '[]'::jsonb else
    coalesce((select jsonb_agg(jsonb_build_object('type', type, 'who', who, 'at', at, 'data', data) order by at desc)
              from (select * from ev order by at desc limit 25) e), '[]'::jsonb) end;
$$;

-- ============================================================
-- Permissions: only the functions above, only for signed-in players
-- ============================================================
do $$
declare f text;
begin
  foreach f in array array[
    'create_room(text, text)', 'join_room(text)', 'set_room_emoji(uuid, text)', 'room_preview(text)', 'my_rooms()',
    'create_challenge(uuid, text, boolean, uuid)', 'start_challenge_round(uuid)',
    'submit_challenge_round(uuid, int, text[])', 'challenge_state(uuid)', 'room_challenges(uuid)', 'room_feed(uuid)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  execute 'revoke all on function public._challenge_open(public.room_challenges) from public, anon, authenticated';
end $$;
