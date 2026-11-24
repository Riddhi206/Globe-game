-- 018_push_cron.sql — runs the `push` Edge Function every minute.
-- Run once, after 017_push.sql and after deploying the function (docs/PUSH.md).
--
-- Before running, replace the two placeholders below:
--   YOUR-PROJECT-REF   from your Supabase URL: https://YOUR-PROJECT-REF.supabase.co
--   YOUR-CRON-SECRET   the PUSH_CRON_SECRET printed by tools/push/vapid-keys.mjs
--
-- Needs the pg_cron and pg_net extensions (Supabase → Database → Extensions).
-- The secret is kept in Supabase Vault, not in the job's text.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- the secret, in Vault (re-running replaces it)
do $$
begin
  if exists (select 1 from vault.secrets where name = 'push_cron_secret') then
    perform vault.update_secret((select id from vault.secrets where name = 'push_cron_secret'), 'YOUR-CRON-SECRET');
  else
    perform vault.create_secret('YOUR-CRON-SECRET', 'push_cron_secret');
  end if;
end $$;

-- every minute (re-running replaces the job)
select cron.unschedule('borderline-push') where exists (select 1 from cron.job where jobname = 'borderline-push');
select cron.schedule('borderline-push', '* * * * *', $job$
  select net.http_post(
    url     := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 25000);
$job$);

-- Check it's working (after a minute or two):
--   select status_code, content, created from net._http_response order by created desc limit 5;
--   select * from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'borderline-push')
--   order by start_time desc limit 5;
