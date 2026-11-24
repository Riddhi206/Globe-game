-- roles.sql — managing roles and feature switches (see 008_roles.sql).
-- Run one snippet at a time in the Supabase SQL editor. Players must have
-- signed in with Google first; replace the email address.

-- Who has a role
select u.email, r.role, r.note, r.granted_at
from public.user_roles r join auth.users u on u.id = r.user_id
order by r.role, u.email;

-- Give someone a role (admin | manager | tester), or change it
insert into public.user_roles (user_id, role, note)
select id, 'tester', 'story beta' from auth.users where email = 'friend@example.com'
on conflict (user_id) do update set role = excluded.role, note = excluded.note, granted_at = now();

-- Take a role away (they become a normal player)
delete from public.user_roles
where user_id = (select id from auth.users where email = 'friend@example.com');

-- Feature switches: who sees what
select key, roles, everyone, note, updated_at from public.features order by key;

-- Launch a feature to everyone (e.g. story mode)
update public.features set everyone = true, updated_at = now() where key = 'story';

-- Back to beta only
update public.features set everyone = false, updated_at = now() where key = 'story';

-- Change which roles see a feature
update public.features set roles = '{admin,tester}', updated_at = now() where key = 'story';

-- Add a new switch for something you're building
insert into public.features (key, roles, note) values ('my_feature', '{admin}', 'what it is')
on conflict (key) do nothing;
