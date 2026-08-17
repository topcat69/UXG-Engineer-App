-- Phase 6: the dashboard's "a status change on a phone appears within two
-- seconds with no refresh" acceptance criterion needs postgres_changes
-- subscriptions on the tables the dashboard's metrics are computed from.
-- `supabase_realtime` exists by default locally but starts with no tables
-- attached — nothing is broadcast until a table is explicitly added.
--
-- Full replica identity so UPDATE payloads include the pre-change row
-- (old_record) as well as the new one — the dashboard doesn't currently
-- diff old vs new, but a status-change feed is exactly the kind of thing
-- that benefits from it later, and there's no meaningful cost to setting
-- it now versus retrofitting it once something needs it.
alter table jobs replica identity full;
alter table issues replica identity full;

alter publication supabase_realtime add table jobs;
alter publication supabase_realtime add table issues;
