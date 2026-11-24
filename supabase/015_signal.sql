-- 015_signal.sql — THE SIGNAL: the story's choices, counted so each episode can
-- open with "62% of players chose the same".
--
-- One row per player per choice. Players can't read the table; they write
-- through signal_choose() and read only totals through signal_split().
-- Safe to run more than once.

create table if not exists public.signal_choices (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  choice_key text not null check (choice_key ~ '^[a-z0-9_]{1,24}$'),
  choice     text not null check (choice ~ '^[a-z0-9_]{1,24}$'),
  timed_out  boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, choice_key)
);
alter table public.signal_choices enable row level security;   -- no policies: through the functions below

create index if not exists signal_choices_key on public.signal_choices (choice_key, choice);

-- Records the player's choice. The first answer counts; replays don't change it.
create or replace function public.signal_choose(p_key text, p_choice text, p_timed_out boolean default false)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not public.has_feature('signal') then raise exception 'not available'; end if;
  insert into public.signal_choices (user_id, choice_key, choice, timed_out)
  values (auth.uid(), p_key, p_choice, coalesce(p_timed_out, false))
  on conflict (user_id, choice_key) do nothing;
end;
$$;

-- How everyone chose: { "ferry": 120, "bazaar": 80 }
create or replace function public.signal_split(p_key text)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(s.choice, s.n), '{}'::jsonb)
  from (select choice, count(*) as n from public.signal_choices
        where choice_key = p_key group by choice) s;
$$;

revoke all on function public.signal_choose(text, text, boolean) from public;
revoke all on function public.signal_split(text)                 from public;
grant execute on function public.signal_choose(text, text, boolean) to authenticated;
grant execute on function public.signal_split(text)                 to anon, authenticated;

-- Pilot switch: admins and managers only. To open it to everyone:
--   update public.features set everyone = true where key = 'signal';
insert into public.features (key, roles, everyone, note) values
  ('signal', '{admin,manager}', false, 'THE SIGNAL story pilot (chat thriller + Pin Drop)')
on conflict (key) do update set roles = excluded.roles, note = excluded.note, updated_at = now();
