-- 008_roles.sql — roles and feature switches. Run after 007_story.sql.
-- Safe to re-run.
--
-- Roles: admin, manager, tester. Everyone else is a "player" (no row).
-- Roles are granted by you, in the SQL editor — players can't read anyone
-- else's role or change their own (no write policies). Give roles to
-- Google-signed-in accounts: an anonymous player's id changes per browser.
-- Ready-made snippets: supabase/queries/roles.sql
--
-- Features: a named switch, on for the listed roles (admin always has every
-- feature), or for everyone. Flip `everyone` to launch a feature to all
-- players without a redeploy.

-- ============================================================
-- Roles
-- ============================================================
create table if not exists public.user_roles (
  user_id    uuid primary key references auth.users on delete cascade,
  role       text not null check (role in ('admin', 'manager', 'tester')),
  note       text,
  granted_at timestamptz not null default now()
);
alter table public.user_roles enable row level security;

drop policy if exists "read own role" on public.user_roles;
create policy "read own role" on public.user_roles
  for select to authenticated using (user_id = (select auth.uid()));

-- ============================================================
-- Feature switches
-- ============================================================
create table if not exists public.features (
  key        text primary key check (key ~ '^[a-z_]{2,40}$'),
  roles      text[] not null default '{}' check (roles <@ array['admin', 'manager', 'tester']),
  everyone   boolean not null default false,
  note       text,
  updated_at timestamptz not null default now()
);
alter table public.features enable row level security;   -- no policies: read through the functions below

insert into public.features (key, roles, everyone, note) values
  ('story',        '{admin,manager,tester}', false, 'Story mode (The Unmaking) — beta until launched to everyone'),
  ('rooms_create', '{admin,manager}',        false, 'Create rooms for groups (used when rooms ship)')
on conflict (key) do nothing;

-- ============================================================
-- What the signed-in player can do: { role, features: [keys] }
-- ============================================================
create or replace function public.my_access()
returns jsonb
language sql stable security definer set search_path = '' as $$
  with me as (
    select coalesce((select role from public.user_roles where user_id = auth.uid()), 'player') as role
  )
  select jsonb_build_object(
    'role', me.role,
    'features', coalesce(
      (select jsonb_agg(f.key order by f.key) from public.features f
        where f.everyone or me.role = 'admin' or me.role = any (f.roles)),
      '[]'::jsonb))
  from me;
$$;

-- Server-side check for other functions and policies, e.g. a future
-- create_room() starts with: if not public.has_feature('rooms_create') then raise …
create or replace function public.has_feature(p_key text)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.features f
    where f.key = p_key
      and (f.everyone or exists (
        select 1 from public.user_roles r
        where r.user_id = auth.uid() and (r.role = 'admin' or r.role = any (f.roles)))));
$$;

revoke all on function public.my_access()        from public;
revoke all on function public.has_feature(text)  from public;
grant execute on function public.my_access()        to anon, authenticated;
grant execute on function public.has_feature(text)  to anon, authenticated;
