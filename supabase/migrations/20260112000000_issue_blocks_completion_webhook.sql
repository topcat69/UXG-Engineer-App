-- Phase 5: auto-create a revisit job when a blocking issue is raised —
-- same reasoning and same mechanism as Phase 4's status-submitted webhook.
-- Issues can be raised from the field app (offline, synced later via the
-- outbox's issue_insert op straight to PostgREST) or from the office UI,
-- and either way the database is the only place guaranteed to see every
-- insert regardless of which client caused it.
create function notify_issue_blocks_completion() returns trigger as $$
declare
  webhook_url text;
  webhook_secret text;
begin
  select value into webhook_url from app_settings where key = 'issue_webhook_url';
  select value into webhook_secret from app_settings where key = 'webhook_secret';

  if new.blocks_completion = true and webhook_url is not null and webhook_secret is not null then
    perform net.http_post(
      url := webhook_url,
      body := jsonb_build_object('issue_id', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json', 'X-Webhook-Secret', webhook_secret)
    );
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, net;

create trigger issues_notify_blocks_completion
  after insert on issues
  for each row execute function notify_issue_blocks_completion();
