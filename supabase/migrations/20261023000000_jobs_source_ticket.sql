-- Service Desk's "Dispatch to engineer" action (an in-house-resolution
-- ticket spinning up a job here) needs a way to tell, on retry, whether a
-- job already exists for a given ticket — this is read back by the
-- dispatch webhook route (src/app/api/webhooks/dispatch-from-ticket) to
-- make the call idempotent instead of creating a duplicate job if Service
-- Desk's request times out and gets retried. Unique and nullable: most
-- jobs have no originating ticket, but any that do must map to exactly
-- one job.
alter table jobs add column source_ticket_id text;
create unique index jobs_source_ticket_id_key on jobs(source_ticket_id) where source_ticket_id is not null;
