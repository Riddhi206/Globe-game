-- 004_friends.sql — friend requests, friendships and the Friends leaderboard.
-- Run after 002_leaderboard.sql. Safe to re-run.
--
-- Tables are only reachable through the functions below (RLS on, no policies).
-- Errors raised here are shown to the player as-is, so keep them friendly.

create table if not exists public.friend_requests (
  from_id    uuid not null references auth.users on delete cascade,
  to_id      uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id),
  check (from_id <> to_id)
);
create index if not exists friend_requests_to_idx on public.friend_requests (to_id);
alter table public.friend_requests enable row level security;

-- Stored both ways (a→b and b→a) so lookups are one index hit
create table if not exists public.friendships (
  user_id    uuid not null references auth.users on delete cascade,
  friend_id  uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);
create index if not exists friendships_friend_idx on public.friendships (friend_id);
alter table public.friendships enable row level security;

-- ============================================================
-- Internal: make two players friends and clear requests between them
-- ============================================================
create or replace function public._make_friends(a uuid, b uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.friend_requests where (from_id = a and to_id = b) or (from_id = b and to_id = a);
  insert into public.friendships (user_id, friend_id) values (a, b), (b, a) on conflict do nothing;
$$;
revoke all on function public._make_friends(uuid, uuid) from public, anon, authenticated;

-- ============================================================
-- send_friend_request — by username. Returns 'sent', or 'friends' when
-- they had already asked us (or we're already friends).
-- ============================================================
create or replace function public.send_friend_request(p_username text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_me   uuid := auth.uid();
  v_them uuid;
begin
  if v_me is null then
    raise exception 'Not signed in';
  end if;
  if not exists (select 1 from public.profiles where id = v_me and username is not null) then
    raise exception 'Pick a leaderboard name first';
  end if;

  select id into v_them from public.profiles where lower(username) = lower(trim(p_username));
  if v_them is null then
    raise exception 'No player called %', trim(p_username);
  end if;
  if v_them = v_me then
    raise exception 'That’s you!';
  end if;

  if exists (select 1 from public.friendships where user_id = v_me and friend_id = v_them) then
    return 'friends';
  end if;
  if exists (select 1 from public.friend_requests where from_id = v_them and to_id = v_me) then
    perform public._make_friends(v_me, v_them);
    return 'friends';
  end if;

  if (select count(*) from public.friendships where user_id = v_me) >= 200 then
    raise exception 'Your friend list is full';
  end if;
  if (select count(*) from public.friend_requests where from_id = v_me) >= 50 then
    raise exception 'Too many pending requests';
  end if;

  insert into public.friend_requests (from_id, to_id) values (v_me, v_them) on conflict do nothing;
  return 'sent';
end $$;

create or replace function public.accept_friend_request(p_from uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.friend_requests where from_id = p_from and to_id = auth.uid()) then
    raise exception 'That request is no longer there';
  end if;
  perform public._make_friends(auth.uid(), p_from);
end $$;

-- Decline an incoming request, cancel an outgoing one, or unfriend
create or replace function public.remove_friend(p_other uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.friend_requests
   where (from_id = auth.uid() and to_id = p_other) or (from_id = p_other and to_id = auth.uid());
  delete from public.friendships
   where (user_id = auth.uid() and friend_id = p_other) or (user_id = p_other and friend_id = auth.uid());
$$;

-- Friends plus pending requests both ways
create or replace function public.my_friends()
returns table (id uuid, username text, status text)
language sql stable security definer set search_path = '' as $$
  select id, coalesce(username, 'player') as username, status from (
    select f.friend_id as id, p.username, 'friend' as status
      from public.friendships f join public.profiles p on p.id = f.friend_id
     where f.user_id = auth.uid()
    union all
    select r.from_id, p.username, 'incoming'
      from public.friend_requests r join public.profiles p on p.id = r.from_id
     where r.to_id = auth.uid()
    union all
    select r.to_id, p.username, 'outgoing'
      from public.friend_requests r join public.profiles p on p.id = r.to_id
     where r.from_id = auth.uid()
  ) x
  order by status, lower(username);
$$;

-- ============================================================
-- Daily leaderboard, now optionally limited to you + your friends
-- ============================================================
drop function if exists public.daily_leaderboard(date, int);

create or replace function public.daily_leaderboard(p_day date, p_limit int default 50, p_friends boolean default false)
returns table (rank bigint, username text, won boolean, guess_count int, score int, is_me boolean, players bigint)
language sql stable security definer set search_path = '' as $$
  with ranked as (
    select s.user_id, p.username, s.won, s.guess_count, s.score,
           row_number() over (order by s.won desc, s.guess_count, s.score desc, s.created_at) as rank,
           count(*) over () as players
    from public.daily_scores s
    join public.profiles p on p.id = s.user_id
    where s.day = p_day and p.username is not null
      and (not p_friends
           or s.user_id = auth.uid()
           or s.user_id in (select friend_id from public.friendships where user_id = auth.uid()))
  )
  select rank, username, won, guess_count, score, user_id = auth.uid(), players
  from ranked
  where rank <= least(greatest(p_limit, 1), 100) or user_id = auth.uid()
  order by rank;
$$;

revoke all on function public.send_friend_request(text)                 from public, anon;
revoke all on function public.accept_friend_request(uuid)               from public, anon;
revoke all on function public.remove_friend(uuid)                       from public, anon;
revoke all on function public.my_friends()                              from public, anon;
revoke all on function public.daily_leaderboard(date, int, boolean)     from public, anon;
grant execute on function public.send_friend_request(text)              to authenticated;
grant execute on function public.accept_friend_request(uuid)            to authenticated;
grant execute on function public.remove_friend(uuid)                    to authenticated;
grant execute on function public.my_friends()                           to authenticated;
grant execute on function public.daily_leaderboard(date, int, boolean)  to authenticated;
