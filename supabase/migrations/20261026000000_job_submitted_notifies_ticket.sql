-- The reverse of dispatch-from-ticket: when a job that originated from a
-- Service Desk ticket (source_ticket_id set — see
-- 20261023000000_jobs_source_ticket.sql) gets submitted by the engineer,
-- post the engineer's own notes back onto that ticket so Service Desk
-- staff see what was found/done without a separate trip to look the job
-- up here. Same mechanism as notify_status_submitted (Phase 4) — a
-- second, independent trigger on the same status_events insert rather
-- than folding this into that one, so the existing manager-email webhook
-- is never at risk from touching this feature, and vice versa.
--
-- "Submitted" (the engineer's own completion of their part), not "closed"
-- (which additionally needs QA review/approval and can lag the actual
-- site visit by hours or days) — Service Desk staff want to know
-- promptly, not once a manager eventually signs off.
--
-- Reuses the existing webhook_secret key from app_settings (same value
-- Service Desk's own ENGINEER_APP_WEBHOOK_SECRET already has to match,
-- for the outbound dispatch call) rather than a new secret to manage; a
-- new key, service_desk_job_submitted_webhook_url, for the URL, following
-- the same one-key-per-webhook-target convention as webhook_url/
-- issue_webhook_url. No real value seeded here, same reasoning as those —
-- set via an authenticated `update app_settings ...` against the real
-- deployment.
create function notify_job_submitted_to_ticket() returns trigger as $$
declare
  webhook_url text;
  webhook_secret text;
  ticket_id text;
  job_number text;
  notes text;
begin
  select value into webhook_url from app_settings where key = 'service_desk_job_submitted_webhook_url';
  select value into webhook_secret from app_settings where key = 'webhook_secret';

  select j.source_ticket_id, j.job_number, jd.engineer_notes
    into ticket_id, job_number, notes
    from jobs j
    left join job_details jd on jd.job_id = j.id
    where j.id = new.job_id;

  if new.to_status = 'submitted' and ticket_id is not null
     and webhook_url is not null and webhook_secret is not null then
    perform net.http_post(
      url := webhook_url,
      body := jsonb_build_object('ticket_id', ticket_id, 'job_number', job_number, 'engineer_notes', notes),
      headers := jsonb_build_object('Content-Type', 'application/json', 'X-Webhook-Secret', webhook_secret)
    );
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, net;

create trigger status_events_notify_job_submitted_to_ticket
  after insert on status_events
  for each row execute function notify_job_submitted_to_ticket();
