-- Phase 4: notify the app when a job is submitted, so it can email the
-- manager — even when the transition comes from the field app, which
-- writes status_events directly via PostgREST and never goes through a
-- Next.js server action. The database itself is the only place guaranteed
-- to see every "submitted" transition regardless of which client caused
-- it, so this uses pg_net (already enabled locally; Supabase's own
-- "Database Webhooks" feature is built on the same mechanism) to fire an
-- async, fire-and-forget POST — it never blocks or fails the status_events
-- insert that triggered it, matching the non-negotiable rule that
-- submission itself must never be blocked by a downstream integration.
--
-- The webhook URL and shared secret live in this table rather than
-- Postgres GUCs (`current_setting`/`ALTER DATABASE ... SET`) because
-- setting a database-level GUC requires superuser/database-owner
-- privileges that the seed connection in this local setup doesn't have —
-- a plain table any role can SELECT from (but not modify, per the RLS
-- below) sidesteps that entirely and is no less secure. This file is
-- committed to git, so it seeds no real values — see supabase/seed.sql for
-- the local-dev-only URL/secret, and configure a real deployment's values
-- via its own migration or an authenticated `update app_settings ...`, never
-- by editing this file.
create table app_settings (
  key text primary key,
  value text not null
);
alter table app_settings enable row level security;
-- Deliberately no policies at all: nothing reaches this table through the
-- API (anon/authenticated roles), only the security-definer trigger
-- function below and direct migration/seed access as the postgres role.

create function notify_status_submitted() returns trigger as $$
declare
  webhook_url text;
  webhook_secret text;
begin
  select value into webhook_url from app_settings where key = 'webhook_url';
  select value into webhook_secret from app_settings where key = 'webhook_secret';

  if new.to_status = 'submitted' and webhook_url is not null and webhook_secret is not null then
    perform net.http_post(
      url := webhook_url,
      body := jsonb_build_object('job_id', new.job_id, 'status_event_id', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json', 'X-Webhook-Secret', webhook_secret)
    );
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, net;

create trigger status_events_notify_submitted
  after insert on status_events
  for each row execute function notify_status_submitted();
