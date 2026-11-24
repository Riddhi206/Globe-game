-- 013_analytics.sql — indexes for the analytics dashboard (tools/dashboard).
-- The dashboard filters events by time, groups them by visit, and looks up each
-- player's first visit; these keep those queries fast as the table grows.
-- Run after 005_events.sql. Safe to re-run.

create index if not exists events_time_idx    on public.events (created_at);
create index if not exists events_session_idx on public.events (session_id);
create index if not exists events_first_visit_idx on public.events (user_id, created_at) where name = 'app_open';
