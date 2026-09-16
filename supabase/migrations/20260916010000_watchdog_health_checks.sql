-- Watchdog Phase 1 (see the "Watchdog" scoping memo): a recurring
-- self-check that catches the failures Sentry structurally can't see —
-- nothing throws, something just silently stops working. This week's
-- actual incident was exactly that shape: the Drive migrations never
-- reached production, every column lookup came back "no such column",
-- and the code at the time only checked a query's data, never its
-- error, so that read as "nothing to sync" and moved on quietly for a
-- day.
--
-- One row per check key (db, schema, cron:<name>, integration:<name>,
-- ...). The health-check cron route is the only thing that ever writes
-- here — same "deliberately no policies at all" posture as
-- app_settings, since nothing needs to reach this through the
-- anon/authenticated API. A superadmin-facing status page (Phase 4,
-- deferred) would add its own read-only policy when/if it's built.
create table health_checks (
  key text primary key,
  is_healthy boolean not null default true,
  last_detail text,
  last_ok_at timestamptz,
  last_fail_at timestamptz,
  last_notified_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table health_checks enable row level security;

-- The schema-drift check. Deliberately a plain SQL function over a
-- fixed list rather than anything that tries to diff against the
-- migrations folder — production has no filesystem access to that
-- folder, only the database itself. Every future migration that adds a
-- column the app depends on appends one row to the `expected` list
-- below, in the same commit — the migration and its own health check
-- land together, so a migration that never reaches production (this
-- week's actual bug) fails this check within 15 minutes instead of
-- silently for a day.
create function check_expected_columns()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(expected.t || '.' || expected.c), array[]::text[])
  from (
    values
      ('clients', 'drive_folder_id'),
      ('sites', 'drive_folder_id'),
      ('jobs', 'drive_folder_id'),
      ('jobs', 'completion_report_drive_file_id'),
      ('media_assets', 'drive_file_id'),
      ('signatures', 'drive_file_id'),
      ('job_details', 'design_pack_drive_file_id'),
      ('job_details', 'parking_permit_drive_file_id'),
      ('job_details', 'rams_drive_file_id'),
      ('job_details', 'site_plan_drive_file_id')
  ) as expected(t, c)
  where not exists (
    select 1
    from information_schema.columns ic
    where ic.table_schema = 'public'
      and ic.table_name = expected.t
      and ic.column_name = expected.c
  );
$$;
-- No explicit grant needed: 20260105000000_grants.sql already grants
-- execute on all functions (and future ones, via default privileges) in
-- this schema to authenticated and service_role.
