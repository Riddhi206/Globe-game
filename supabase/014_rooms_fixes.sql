-- 014_rooms_fixes.sql — game night and activity fixes.
-- Run after 011_rooms_hub.sql. Safe to re-run.
--
--   · Any member can start a game night (whoever starts it hosts it). A night
--     that's already on can't be replaced by a member, only by its host or a
--     room manager.
--   · Round 1 needs at least 2 players in the lobby.
--   · A player is listed once, even on a database where night_players is
--     missing its primary key (see 010_rooms_keys.sql): joins skip existing
--     rows and the scoreboard counts each player once.
--   · The room activity feed returns everything from the last 3 days.

create or replace function public.start_night(p_room uuid, p_rounds int default 5, p_seconds int default 120)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_live public.room_nights;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if exists (select 1 from public.rooms where id = p_room and closed_at is not null) then raise exception 'room not found'; end if;
  if not (public._is_room_member(p_room) or public._is_admin()) then raise exception 'not a member'; end if;
  select * into v_live from public.room_nights n
  where n.room_id = p_room and not public._night_over(n) order by n.created_at desc limit 1;
  if v_live.id is not null then
    if not (v_live.host_id = auth.uid() or public._can_manage_room(p_room)) then raise exception 'night already on'; end if;
    update public.room_nights set status = 'ended', ended_at = now() where room_id = p_room and status <> 'ended';
  end if;
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
  insert into public.night_players (night_id, user_id)
  select p_night, auth.uid()
  where not exists (select 1 from public.night_players where night_id = p_night and user_id = auth.uid());
end $$;

create or replace function public.start_round(p_night uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare n public.room_nights; v_country text;
begin
  select * into n from public.room_nights where id = p_night for update;
  if n.id is null or public._night_over(n) then raise exception 'night is over'; end if;
  if not (n.host_id = auth.uid() or public._can_manage_room(n.room_id)) then raise exception 'not allowed'; end if;
  if n.current_round >= n.rounds then raise exception 'no rounds left'; end if;
  if n.current_round = 0 and (select count(distinct user_id) from public.night_players where night_id = p_night) < 2 then
    raise exception 'need two players';
  end if;
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

-- Live state, polled every couple of seconds by players and the TV view.
-- Same as 009_rooms.sql, but every player counts once.
create or replace function public.night_state(p_night uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare n public.room_nights; v_player boolean; v_round_over boolean; v_phase text; v_ends timestamptz;
        v_players int; v_submitted int;
begin
  select * into n from public.room_nights where id = p_night;
  if n.id is null then raise exception 'night not found'; end if;
  v_player := exists (select 1 from public.night_players where night_id = p_night and user_id = auth.uid());
  v_ends   := n.round_started_at + make_interval(secs => n.round_seconds);
  select count(distinct user_id) into v_players from public.night_players where night_id = p_night;
  select count(distinct user_id) into v_submitted from public.night_results where night_id = p_night and round = n.current_round;
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
               coalesce((select sum(points) from (select distinct on (x.round) x.points from public.night_results x
                          where x.night_id = p_night and x.user_id = np.user_id order by x.round, x.submitted_at) r), 0) as points,
               (select jsonb_build_object('found', x.found, 'guesses', x.guess_count, 'seconds', x.seconds, 'points', x.points)
                  from public.night_results x
                 where x.night_id = p_night and x.round = n.current_round and x.user_id = np.user_id
                 order by x.submitted_at limit 1) as this_round
        from (select distinct user_id from public.night_players where night_id = p_night) np
        join public.profiles p on p.id = np.user_id
      ) t), '[]'::jsonb)
  );
end $$;

-- Activity feed: everything from the last 3 days (was capped at 25)
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
              from (select * from ev order by at desc limit 200) e), '[]'::jsonb) end;
$$;

do $$
declare f text;
begin
  foreach f in array array['start_night(uuid, int, int)', 'join_night(uuid)', 'start_round(uuid)', 'night_state(uuid)', 'room_feed(uuid)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
