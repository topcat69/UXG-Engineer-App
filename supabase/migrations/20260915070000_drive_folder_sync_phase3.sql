-- Phase 3 of the Drive folder sync: mirrors files into their job's Drive
-- folder (created in Phase 2) once they land in Supabase Storage — field
-- photos/videos (media_assets), signatures, and the four office-prepared
-- documents on job_details (RAMS, site plan, design pack, parking permit).
--
-- One drive_file_id column per file, same shape as each row's existing
-- storage_path column(s) — job_details gets four, matching its four
-- separate storage_path columns, rather than one shared column that
-- couldn't tell which document it referred to.
--
-- media_assets/signatures rows are written straight from the browser to
-- Storage (see lib/offline/outbox.ts's drainMediaQueue — it runs
-- client-side, with no server round-trip to hook a sync into), so unlike
-- the client/project/job folders in Phase 1/2, mirroring these can't run
-- inside the request that creates the row. It's picked up after the fact
-- by a polling cron route instead (see api/cron/drive-media-sync/route.ts),
-- same "hit periodically by an external scheduler" shape as the existing
-- media-lifecycle cron.
alter table media_assets add column drive_file_id text;
alter table signatures add column drive_file_id text;
alter table job_details
  add column rams_drive_file_id text,
  add column site_plan_drive_file_id text,
  add column design_pack_drive_file_id text,
  add column parking_permit_drive_file_id text;
