-- 019_feedback.sql — "Feedback" in the home footer. Run after 017_push.sql. Safe to re-run.
--
-- Players write through send_feedback() only; nobody can read the table from the app.
-- Read it in the dashboard (Live & players tab) or here:
--   select created_at, kind, message, contact, meta->>'platform' as platform from public.feedback order by id desc;

create table if not exists public.feedback (
  id         bigint generated always as identity primary key,
  user_id    uuid default auth.uid() references auth.users on delete set null,
  kind       text not null check (kind in ('bug', 'idea', 'other')),
  message    text not null check (char_length(btrim(message)) between 3 and 2000),
  contact    text check (contact is null or char_length(contact) <= 120),
  meta       jsonb not null default '{}'::jsonb check (pg_column_size(meta) <= 2000),
  created_at timestamptz not null default now()
);
create index if not exists feedback_time_idx on public.feedback (created_at desc);
alter table public.feedback enable row level security;   -- no policies: write through the function below

create or replace function public.send_feedback(p_kind text, p_message text, p_contact text default null, p_meta jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  -- 5 an hour per player is plenty, and stops a stuck button or a script from flooding it
  if (select count(*) from public.feedback where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'too many';
  end if;
  insert into public.feedback (kind, message, contact, meta)
  values (p_kind, btrim(p_message), nullif(btrim(coalesce(p_contact, '')), ''), coalesce(p_meta, '{}'::jsonb));
end $$;

revoke all on function public.send_feedback(text, text, text, jsonb) from public, anon;
grant execute on function public.send_feedback(text, text, text, jsonb) to authenticated;
