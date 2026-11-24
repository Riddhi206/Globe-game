-- 009_rooms.sql — rooms: private groups with a Daily league, and live game
-- nights. Run after 008_roles.sql. Safe to re-run.
--
-- A room is a club ("Thursday Board Gamers"). Members join with a 6-letter
-- code or invite link. Between meetups the room ranks its members' normal
-- Daily results (the same server-checked daily_scores the global
-- leaderboard uses). At a meetup the host starts a game night: timed
-- rounds where everyone hunts the same country, server-picked, with a live
-- scoreboard. Players stay normal players; rooms never touch global ranks.
--
-- Rules: creating a room needs the 'rooms_create' switch (008_roles.sql).
-- A player can be in 5 rooms (people who can create rooms: no limit); a
-- room holds 50. Joining needs a leaderboard name, not a Google account.
-- The room's creator (or an admin) manages it.
--
-- All access goes through the functions below; the tables have RLS on and
-- no policies, so clients can't read or write them directly.

-- ============================================================
-- Tables
-- ============================================================
create table if not exists public.rooms (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique check (code ~ '^[A-Z2-9]{6}$'),
  name       text not null check (char_length(btrim(name)) between 2 and 40),
  owner_id   uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  closed_at  timestamptz
);

create table if not exists public.room_members (
  room_id   uuid not null references public.rooms on delete cascade,
  user_id   uuid not null references auth.users on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index if not exists room_members_user_idx on public.room_members (user_id);

-- A game night: `rounds` timed rounds, one country each
create table if not exists public.room_nights (
  id               uuid primary key default gen_random_uuid(),
  room_id          uuid not null references public.rooms on delete cascade,
  host_id          uuid not null references auth.users on delete cascade,
  rounds           int  not null check (rounds between 1 and 10),
  round_seconds    int  not null check (round_seconds between 30 and 600),
  current_round    int  not null default 0,
  round_started_at timestamptz,
  status           text not null default 'lobby' check (status in ('lobby', 'playing', 'ended')),
  created_at       timestamptz not null default now(),
  ended_at         timestamptz
);
create index if not exists room_nights_room_idx on public.room_nights (room_id, created_at desc);

create table if not exists public.night_players (
  night_id  uuid not null references public.room_nights on delete cascade,
  user_id   uuid not null references auth.users on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (night_id, user_id)
);

create table if not exists public.night_rounds (
  night_id uuid not null references public.room_nights on delete cascade,
  round    int  not null,
  mystery  text not null,
  primary key (night_id, round)
);

create table if not exists public.night_results (
  night_id     uuid not null references public.room_nights on delete cascade,
  round        int  not null,
  user_id      uuid not null references auth.users on delete cascade,
  found        boolean not null,
  guess_count  int  not null,
  seconds      int  not null,
  points       int  not null,
  submitted_at timestamptz not null default now(),
  primary key (night_id, round, user_id)
);

alter table public.rooms          enable row level security;
alter table public.room_members   enable row level security;
alter table public.room_nights    enable row level security;
alter table public.night_players  enable row level security;
alter table public.night_rounds   enable row level security;
alter table public.night_results  enable row level security;

-- ============================================================
-- Helpers
-- ============================================================
create or replace function public._room_code()
returns text language sql volatile set search_path = '' as $$
  -- 31 characters: no I, L, O, 0 or 1, so codes read aloud cleanly
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
  from generate_series(1, 6);
$$;

create or replace function public._is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin');
$$;

create or replace function public._can_manage_room(p_room uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.rooms where id = p_room and (owner_id = auth.uid() or public._is_admin()));
$$;

create or replace function public._is_room_member(p_room uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.room_members where room_id = p_room and user_id = auth.uid());
$$;

create or replace function public._my_username()
returns text language sql stable security definer set search_path = '' as $$
  select username from public.profiles where id = auth.uid();
$$;

-- A night is over when ended, or abandoned for 3 hours
create or replace function public._night_over(n public.room_nights)
returns boolean language sql stable set search_path = '' as $$
  select n.status = 'ended' or n.created_at < now() - interval '3 hours';
$$;

-- ============================================================
-- Rooms
-- ============================================================
create or replace function public.create_room(p_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_code text; v_id uuid; v_name text := btrim(p_name);
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not public.has_feature('rooms_create') then raise exception 'not allowed'; end if;
  if public._my_username() is null then raise exception 'pick a name first'; end if;
  if char_length(v_name) not between 2 and 40 then raise exception 'room name must be 2-40 characters'; end if;
  if (select count(*) from public.rooms where owner_id = auth.uid() and closed_at is null) >= 20 then
    raise exception 'too many rooms';
  end if;
  loop
    v_code := public._room_code();
    exit when not exists (select 1 from public.rooms where code = v_code);
  end loop;
  insert into public.rooms (code, name, owner_id) values (v_code, v_name, auth.uid()) returning id into v_id;
  insert into public.room_members (room_id, user_id) values (v_id, auth.uid());
  return jsonb_build_object('id', v_id, 'code', v_code, 'name', v_name);
end $$;

-- What an invite link shows before joining
create or replace function public.room_preview(p_code text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', r.id, 'name', r.name,
    'members', (select count(*) from public.room_members m where m.room_id = r.id),
    'full', (select count(*) from public.room_members m where m.room_id = r.id) >= 50,
    'member', public._is_room_member(r.id))
  from public.rooms r
  where r.code = upper(btrim(p_code)) and r.closed_at is null;
$$;

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
          where m.user_id = auth.uid() and x.closed_at is null) >= 5 then
    raise exception 'room limit';
  end if;
  insert into public.room_members (room_id, user_id) values (r.id, auth.uid()) on conflict do nothing;
  return jsonb_build_object('id', r.id, 'name', r.name);
end $$;

create or replace function public.leave_room(p_room uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.rooms where id = p_room and owner_id = auth.uid()) then
    raise exception 'owner cannot leave';
  end if;
  delete from public.room_members where room_id = p_room and user_id = auth.uid();
end $$;

create or replace function public.remove_room_member(p_room uuid, p_username text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;
begin
  if not public._can_manage_room(p_room) then raise exception 'not allowed'; end if;
  select p.id into v_uid from public.profiles p join public.room_members m on m.user_id = p.id
  where m.room_id = p_room and p.username = p_username;
  if v_uid is null then raise exception 'not a member'; end if;
  if exists (select 1 from public.rooms where id = p_room and owner_id = v_uid) then raise exception 'cannot remove the owner'; end if;
  delete from public.room_members where room_id = p_room and user_id = v_uid;
end $$;

-- New code; the old invite link stops working
create or replace function public.reset_room_code(p_room uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_code text;
begin
  if not public._can_manage_room(p_room) then raise exception 'not allowed'; end if;
  loop
    v_code := public._room_code();
    exit when not exists (select 1 from public.rooms where code = v_code);
  end loop;
  update public.rooms set code = v_code where id = p_room;
  return v_code;
end $$;

create or replace function public.rename_room(p_room uuid, p_name text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public._can_manage_room(p_room) then raise exception 'not allowed'; end if;
  if char_length(btrim(p_name)) not between 2 and 40 then raise exception 'room name must be 2-40 characters'; end if;
  update public.rooms set name = btrim(p_name) where id = p_room;
end $$;

-- Closed rooms disappear for everyone; their history stays in the database
create or replace function public.close_room(p_room uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public._can_manage_room(p_room) then raise exception 'not allowed'; end if;
  update public.rooms set closed_at = now() where id = p_room and closed_at is null;
  update public.room_nights set status = 'ended', ended_at = now() where room_id = p_room and status <> 'ended';
end $$;

-- The home card and the rooms list
create or replace function public.my_rooms()
returns jsonb language sql stable security definer set search_path = '' as $$
  with today as (select (now() at time zone 'utc')::date as d)
  select coalesce(jsonb_agg(x order by x->>'name'), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', r.id, 'name', r.name, 'code', r.code,
      'members', (select count(*) from public.room_members m where m.room_id = r.id),
      'played_today', (select count(*) from public.room_members m join public.daily_scores s
                         on s.user_id = m.user_id and s.day = (select d from today) where m.room_id = r.id),
      'my_rank_today', (select rk from (
          select s.user_id, row_number() over (order by s.won desc, s.guess_count, s.score desc, s.created_at) as rk
          from public.room_members m join public.daily_scores s on s.user_id = m.user_id and s.day = (select d from today)
          where m.room_id = r.id) t where t.user_id = auth.uid()),
      'can_manage', r.owner_id = auth.uid() or public._is_admin(),
      'live_night', (select n.id from public.room_nights n
                     where n.room_id = r.id and not public._night_over(n) order by n.created_at desc limit 1)
    ) as x
    from public.rooms r join public.room_members me on me.room_id = r.id and me.user_id = auth.uid()
    where r.closed_at is null
  ) q;
$$;

-- Everything the room screen shows. p_period: 'today' | 'week' | 'all'
create or replace function public.room_view(p_room uuid, p_period text default 'today')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r public.rooms; v_today date := (now() at time zone 'utc')::date; v_from date; v_out jsonb;
begin
  select * into r from public.rooms where id = p_room and closed_at is null;
  if r.id is null or not (public._is_room_member(p_room) or public._is_admin()) then raise exception 'room not found'; end if;
  v_from := case p_period when 'week' then v_today - 6 when 'all' then (r.created_at at time zone 'utc')::date else v_today end;

  with members as (
    select m.user_id, p.username, m.joined_at from public.room_members m
    join public.profiles p on p.id = m.user_id where m.room_id = p_room
  ),
  streak_days as (
    select s.user_id, s.day, s.day - (row_number() over (partition by s.user_id order by s.day))::int as grp
    from public.daily_scores s where s.user_id in (select user_id from members)
  ),
  streaks as (
    select user_id, max(len) as streak from (
      select user_id, grp, count(*) as len, max(day) as last_day from streak_days group by user_id, grp
    ) t where last_day >= v_today - 1 group by user_id
  ),
  league as (
    select mb.username, mb.user_id = auth.uid() as is_me,
           count(s.day) as played, count(*) filter (where s.won) as wins,
           round(avg(s.guess_count) filter (where s.won), 1) as avg_guesses,
           coalesce(sum(s.score), 0) as score,
           bool_or(s.won) as won_today, min(s.guess_count) as guess_count, min(s.created_at) as first_at
    from members mb join public.daily_scores s on s.user_id = mb.user_id and s.day between v_from and v_today
    where mb.username is not null
    group by mb.user_id, mb.username
  ),
  nights as (
    select n.id, n.created_at from public.room_nights n
    where n.room_id = p_room and public._night_over(n)
      and exists (select 1 from public.night_results x where x.night_id = n.id)
  ),
  night_totals as (
    -- one winner per night: most points, then fastest overall, then first in
    select n.id as night_id, n.created_at, x.user_id, sum(x.points) as points,
           row_number() over (partition by n.id order by sum(x.points) desc, sum(x.seconds), min(x.submitted_at)) as place
    from nights n join public.night_results x on x.night_id = n.id
    group by n.id, n.created_at, x.user_id
  )
  select jsonb_build_object(
    'room', jsonb_build_object('id', r.id, 'name', r.name, 'code', r.code, 'created_at', r.created_at,
                               'can_manage', r.owner_id = auth.uid() or public._is_admin(),
                               'is_owner', r.owner_id = auth.uid()),
    'period', p_period,
    'members', coalesce((select jsonb_agg(jsonb_build_object(
        'username', mb.username, 'is_owner', mb.user_id = r.owner_id, 'is_me', mb.user_id = auth.uid(),
        'streak', coalesce(st.streak, 0),
        'played_today', exists (select 1 from public.daily_scores s where s.user_id = mb.user_id and s.day = v_today))
        order by mb.joined_at)
      from members mb left join streaks st on st.user_id = mb.user_id), '[]'::jsonb),
    'league', coalesce((select jsonb_agg(row_to_json(l)::jsonb order by l.rank) from (
        select row_number() over (order by
                 case when p_period = 'today' then (case when won_today then 0 else 1 end) end,
                 case when p_period = 'today' then guess_count end,
                 score desc, wins desc, first_at) as rank,
               username, is_me, played, wins, avg_guesses, score, won_today, guess_count
        from league) l), '[]'::jsonb),
    'nights', coalesce((select jsonb_agg(jsonb_build_object(
        'id', t.night_id, 'date', t.created_at,
        'players', (select count(distinct user_id) from night_totals z where z.night_id = t.night_id),
        'winner', p.username, 'points', t.points) order by t.created_at desc)
      from night_totals t join public.profiles p on p.id = t.user_id where t.place = 1), '[]'::jsonb),
    'night_standings', coalesce((select jsonb_agg(row_to_json(s)::jsonb order by s.wins desc, s.points desc) from (
        select p.username, t.user_id = auth.uid() as is_me, count(*) as nights,
               count(*) filter (where t.place = 1) as wins, sum(t.points) as points
        from night_totals t join public.profiles p on p.id = t.user_id
        group by t.user_id, p.username) s), '[]'::jsonb),
    'live_night', (select jsonb_build_object('id', n.id, 'status', n.status) from public.room_nights n
                   where n.room_id = p_room and not public._night_over(n) order by n.created_at desc limit 1)
  ) into v_out;
  return v_out;
end $$;

-- ============================================================
-- Game nights
-- ============================================================
create or replace function public.start_night(p_room uuid, p_rounds int default 5, p_seconds int default 120)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public._can_manage_room(p_room) then raise exception 'not allowed'; end if;
  if exists (select 1 from public.rooms where id = p_room and closed_at is not null) then raise exception 'room not found'; end if;
  update public.room_nights set status = 'ended', ended_at = now() where room_id = p_room and status <> 'ended';
  insert into public.room_nights (room_id, host_id, rounds, round_seconds)
  values (p_room, auth.uid(), least(greatest(p_rounds, 1), 10), least(greatest(p_seconds, 30), 600))
  returning id into v_id;
  insert into public.night_players (night_id, user_id) values (v_id, auth.uid());
  return v_id;
end $$;

create or replace function public.join_night(p_night uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare n public.room_nights;
begin
  select * into n from public.room_nights where id = p_night;
  if n.id is null or public._night_over(n) then raise exception 'night is over'; end if;
  if not public._is_room_member(n.room_id) then raise exception 'not a member'; end if;
  insert into public.night_players (night_id, user_id) values (p_night, auth.uid()) on conflict do nothing;
end $$;

-- Host: next round. The server picks the country (never today's Daily, never
-- one already used tonight) so the host can't choose it.
create or replace function public.start_round(p_night uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare n public.room_nights; v_country text;
begin
  select * into n from public.room_nights where id = p_night for update;
  if n.id is null or public._night_over(n) then raise exception 'night is over'; end if;
  if not (n.host_id = auth.uid() or public._can_manage_room(n.room_id)) then raise exception 'not allowed'; end if;
  if n.current_round >= n.rounds then raise exception 'no rounds left'; end if;
  select c.country into v_country from (select distinct country from public.daily_answers) c
  where c.country <> coalesce((select country from public.daily_answers where day = (now() at time zone 'utc')::date), '')
    and c.country not in (select mystery from public.night_rounds where night_id = p_night)
  order by random() limit 1;
  if v_country is null then raise exception 'no countries left'; end if;
  insert into public.night_rounds (night_id, round, mystery) values (p_night, n.current_round + 1, v_country);
  update public.room_nights set current_round = n.current_round + 1, round_started_at = now(), status = 'playing'
  where id = p_night;
  return n.current_round + 1;
end $$;

-- A player's round result. Points: found = 1000 − 100 per extra guess (min
-- 100) + up to 300 for speed; not found = 0. The last guess must be the
-- round's country for it to count as found.
create or replace function public.submit_round(p_night uuid, p_round int, p_guesses text[], p_seconds int)
returns int language plpgsql security definer set search_path = '' as $$
declare n public.room_nights; v_mystery text; v_n int := coalesce(array_length(p_guesses, 1), 0);
        v_found boolean; v_secs int; v_points int;
begin
  select * into n from public.room_nights where id = p_night;
  if n.id is null or public._night_over(n) then raise exception 'night is over'; end if;
  if not exists (select 1 from public.night_players where night_id = p_night and user_id = auth.uid()) then
    raise exception 'not in this night';
  end if;
  if p_round <> n.current_round or n.status <> 'playing' then raise exception 'round is closed'; end if;
  if now() > n.round_started_at + make_interval(secs => n.round_seconds + 10) then raise exception 'round is closed'; end if;
  if (select count(distinct g) from unnest(p_guesses) g) <> v_n then raise exception 'duplicate guesses'; end if;
  select mystery into v_mystery from public.night_rounds where night_id = p_night and round = p_round;
  v_found  := v_n > 0 and p_guesses[v_n] = v_mystery;
  v_secs   := least(greatest(coalesce(p_seconds, n.round_seconds), 0), n.round_seconds);
  v_points := case when v_found
                then greatest(100, 1000 - 100 * (v_n - 1)) + round(300 * (1 - v_secs::numeric / n.round_seconds))::int
                else 0 end;
  insert into public.night_results (night_id, round, user_id, found, guess_count, seconds, points)
  values (p_night, p_round, auth.uid(), v_found, v_n, v_secs, v_points)
  on conflict do nothing;
  -- one result per player per round: a resubmission gets the first one back
  return (select points from public.night_results where night_id = p_night and round = p_round and user_id = auth.uid());
end $$;

create or replace function public.end_night(p_night uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare n public.room_nights;
begin
  select * into n from public.room_nights where id = p_night;
  if n.id is null then raise exception 'night not found'; end if;
  if not (n.host_id = auth.uid() or public._can_manage_room(n.room_id)) then raise exception 'not allowed'; end if;
  update public.room_nights set status = 'ended', ended_at = now() where id = p_night and status <> 'ended';
end $$;

-- Live state, polled every couple of seconds by players and the TV view.
-- phase: lobby | playing | between | final | ended. The round's country is
-- only sent to players of the night while it's being played (and revealed
-- once the round is over). Anyone with the night's id can watch the
-- scoreboard (the TV view), but never sees the country before the reveal.
create or replace function public.night_state(p_night uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare n public.room_nights; v_player boolean; v_round_over boolean; v_phase text; v_ends timestamptz;
        v_players int; v_submitted int;
begin
  select * into n from public.room_nights where id = p_night;
  if n.id is null then raise exception 'night not found'; end if;
  v_player := exists (select 1 from public.night_players where night_id = p_night and user_id = auth.uid());
  v_ends   := n.round_started_at + make_interval(secs => n.round_seconds);
  select count(*) into v_players from public.night_players where night_id = p_night;
  select count(*) into v_submitted from public.night_results where night_id = p_night and round = n.current_round;
  v_round_over := n.status = 'playing' and (now() > v_ends or v_submitted >= v_players);
  v_phase := case
    when public._night_over(n) then 'ended'
    when n.status = 'lobby' then 'lobby'
    when v_round_over and n.current_round >= n.rounds then 'final'
    when v_round_over then 'between'
    else 'playing' end;

  return jsonb_build_object(
    'id', n.id, 'room_id', n.room_id,
    'room_name', (select name from public.rooms where id = n.room_id),
    'phase', v_phase, 'round', n.current_round, 'rounds', n.rounds, 'round_seconds', n.round_seconds,
    'round_started_at', (extract(epoch from n.round_started_at) * 1000)::bigint,
    'server_now', (extract(epoch from now()) * 1000)::bigint,
    'is_host', n.host_id = auth.uid() or public._can_manage_room(n.room_id),
    'is_player', v_player,
    'is_member', public._is_room_member(n.room_id),
    'mystery', case when v_phase = 'playing' and v_player
                    then (select mystery from public.night_rounds where night_id = p_night and round = n.current_round) end,
    'last_mystery', case when v_phase in ('between', 'final', 'ended')
                         then (select mystery from public.night_rounds where night_id = p_night and round = n.current_round) end,
    'players', coalesce((select jsonb_agg(row_to_json(t)::jsonb order by t.points desc, t.username) from (
        select p.username, np.user_id = auth.uid() as is_me, np.user_id = n.host_id as is_host,
               coalesce((select sum(points) from public.night_results x where x.night_id = p_night and x.user_id = np.user_id), 0) as points,
               (select jsonb_build_object('found', x.found, 'guesses', x.guess_count, 'seconds', x.seconds, 'points', x.points)
                  from public.night_results x
                 where x.night_id = p_night and x.round = n.current_round and x.user_id = np.user_id) as this_round
        from public.night_players np join public.profiles p on p.id = np.user_id
      ) t), '[]'::jsonb)
  );
end $$;

-- ============================================================
-- Permissions: only the functions above, only for signed-in players
-- (every visitor is signed in, anonymously at least)
-- ============================================================
do $$
declare f text;
begin
  foreach f in array array[
    'create_room(text)', 'room_preview(text)', 'join_room(text)', 'leave_room(uuid)',
    'remove_room_member(uuid, text)', 'reset_room_code(uuid)', 'rename_room(uuid, text)', 'close_room(uuid)',
    'my_rooms()', 'room_view(uuid, text)', 'start_night(uuid, int, int)', 'join_night(uuid)',
    'start_round(uuid)', 'submit_round(uuid, int, text[], int)', 'end_night(uuid)', 'night_state(uuid)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['_room_code()', '_is_admin()', '_can_manage_room(uuid)', '_is_room_member(uuid)',
                           '_my_username()', '_night_over(public.room_nights)']
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;
