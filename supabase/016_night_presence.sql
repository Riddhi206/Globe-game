-- 016_night_presence.sql — leaving a game night, and knowing who's really there.
-- Run after 014_rooms_fixes.sql. Safe to re-run.
--
--   · leave_night(): Leave takes you out of the night (you stay in the room).
--     Leave in the lobby and you're off the list; leave mid-game and your points
--     stay on the board. If the host leaves, the next player in line hosts.
--     When the last player leaves, the night ends.
--   · Presence: every night_state() poll (every 2 s while the night is open)
--     marks the caller as seen. Someone who closed the app drops off the lobby
--     after 45 seconds.
--   · A night nobody has looked at for 2 minutes is over, so a room no longer
--     shows LIVE for a night with no game and nobody waiting.

alter table public.night_players add column if not exists seen_at timestamptz not null default now();
alter table public.night_players add column if not exists left_at timestamptz;

-- Over when ended, abandoned for 3 hours, or nobody has been there for 2 minutes
create or replace function public._night_over(n public.room_nights)
returns boolean language sql stable set search_path = '' as $$
  select n.status = 'ended'
      or n.created_at < now() - interval '3 hours'
      or not exists (select 1 from public.night_players p
                     where p.night_id = n.id and p.left_at is null and p.seen_at > now() - interval '2 minutes');
$$;

-- Players in the night right now: not left, seen in the last 45 seconds
create or replace function public._night_present(p_night uuid)
returns int language sql stable set search_path = '' as $$
  select count(distinct user_id)::int from public.night_players
  where night_id = p_night and left_at is null and seen_at > now() - interval '45 seconds';
$$;

-- Joining (or coming back after leaving)
create or replace function public.join_night(p_night uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare n public.room_nights;
begin
  select * into n from public.room_nights where id = p_night;
  if n.id is null or public._night_over(n) then raise exception 'night is over'; end if;
  if not public._is_room_member(n.room_id) then raise exception 'not a member'; end if;
  update public.night_players set left_at = null, seen_at = now()
  where night_id = p_night and user_id = auth.uid();
  if not found then
    insert into public.night_players (night_id, user_id) values (p_night, auth.uid());
  end if;
end $$;

-- Leaving the night (not the room)
create or replace function public.leave_night(p_night uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare n public.room_nights; v_next uuid;
begin
  select * into n from public.room_nights where id = p_night for update;
  if n.id is null then return; end if;
  if n.status = 'lobby' then
    delete from public.night_players where night_id = p_night and user_id = auth.uid();
  else
    update public.night_players set left_at = now() where night_id = p_night and user_id = auth.uid();
  end if;
  if n.status = 'ended' then return; end if;
  if n.host_id = auth.uid() then
    select user_id into v_next from public.night_players
    where night_id = p_night and left_at is null and user_id <> auth.uid()
    order by (seen_at > now() - interval '45 seconds') desc, joined_at limit 1;
    if v_next is not null then update public.room_nights set host_id = v_next where id = p_night; end if;
  end if;
  if not exists (select 1 from public.night_players where night_id = p_night and left_at is null) then
    update public.room_nights set status = 'ended', ended_at = now() where id = p_night;
  end if;
end $$;

-- Round 1 needs 2 players who are actually here
create or replace function public.start_round(p_night uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare n public.room_nights; v_country text;
begin
  select * into n from public.room_nights where id = p_night for update;
  if n.id is null or public._night_over(n) then raise exception 'night is over'; end if;
  if not (n.host_id = auth.uid() or public._can_manage_room(n.room_id)) then raise exception 'not allowed'; end if;
  if n.current_round >= n.rounds then raise exception 'no rounds left'; end if;
  if n.current_round = 0 and public._night_present(p_night) < 2 then raise exception 'need two players'; end if;
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

-- Live state, polled every couple of seconds. Also marks the caller as here.
-- The lobby lists who's here now; once the night starts, everyone who played
-- stays on the board (leavers marked), and a round ends when everyone still
-- here has played it.
create or replace function public.night_state(p_night uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare n public.room_nights; v_player boolean; v_round_over boolean; v_phase text; v_ends timestamptz;
        v_players int; v_submitted int;
begin
  update public.night_players set seen_at = now()
  where night_id = p_night and user_id = auth.uid() and left_at is null;
  select * into n from public.room_nights where id = p_night;
  if n.id is null then raise exception 'night not found'; end if;
  v_player := exists (select 1 from public.night_players where night_id = p_night and user_id = auth.uid() and left_at is null);
  v_ends   := n.round_started_at + make_interval(secs => n.round_seconds);
  v_players := public._night_present(p_night);
  select count(distinct r.user_id) into v_submitted from public.night_results r
  join public.night_players p on p.night_id = r.night_id and p.user_id = r.user_id
  where r.night_id = p_night and r.round = n.current_round and p.left_at is null and p.seen_at > now() - interval '45 seconds';
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
    'present', v_players,
    'mystery', case when v_phase = 'playing' and v_player
                    then (select mystery from public.night_rounds where night_id = p_night and round = n.current_round) end,
    'last_mystery', case when v_phase in ('between', 'final', 'ended')
                         then (select mystery from public.night_rounds where night_id = p_night and round = n.current_round) end,
    'players', coalesce((select jsonb_agg(row_to_json(t)::jsonb order by t.points desc, t.username) from (
        select p.username, np.user_id = auth.uid() as is_me, np.user_id = n.host_id as is_host,
               np.gone as left,
               coalesce((select sum(points) from (select distinct on (x.round) x.points from public.night_results x
                          where x.night_id = p_night and x.user_id = np.user_id order by x.round, x.submitted_at) r), 0) as points,
               (select jsonb_build_object('found', x.found, 'guesses', x.guess_count, 'seconds', x.seconds, 'points', x.points)
                  from public.night_results x
                 where x.night_id = p_night and x.round = n.current_round and x.user_id = np.user_id
                 order by x.submitted_at limit 1) as this_round
        from (select user_id, bool_and(left_at is not null) as gone, max(seen_at) as seen_at
                from public.night_players where night_id = p_night group by user_id) np
        join public.profiles p on p.id = np.user_id
        where case when n.status = 'lobby'
                   then not np.gone and np.seen_at > now() - interval '45 seconds'
                   else not np.gone or exists (select 1 from public.night_results x where x.night_id = p_night and x.user_id = np.user_id) end
      ) t), '[]'::jsonb)
  );
end $$;

do $$
begin
  revoke all on function public.leave_night(uuid) from public, anon;
  grant execute on function public.leave_night(uuid) to authenticated;
  revoke all on function public._night_present(uuid) from public, anon, authenticated;
end $$;
