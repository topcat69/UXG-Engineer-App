-- Logs every issue raised (office or field-raised) to Monday.com, not just
-- the ones that block completion — unlike notify_issue_blocks_completion,
-- this trigger has no `if new.blocks_completion` condition. Same mechanism
-- as the other DB webhooks: the database is the only place guaranteed to
-- see every insert regardless of which client caused it.
create function notify_issue_created_monday() returns trigger as $$
declare
  webhook_url text;
  webhook_secret text;
begin
  select value into webhook_url from app_settings where key = 'monday_issue_webhook_url';
  select value into webhook_secret from app_settings where key = 'webhook_secret';

  if webhook_url is not null and webhook_secret is not null then
    perform net.http_post(
      url := webhook_url,
      body := jsonb_build_object('issue_id', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json', 'X-Webhook-Secret', webhook_secret)
    );
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, net;

create trigger issues_notify_monday
  after insert on issues
  for each row execute function notify_issue_created_monday();
