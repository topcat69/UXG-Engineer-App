-- Watchdog Phase 2 (see the "Watchdog" scoping memo): one row per
-- existing cron route (day-before-reminders, weekly-summary,
-- media-lifecycle, drive-media-sync), written on every invocation by
-- recordCronHeartbeat (lib/health/heartbeat.ts) — the raw evidence a
-- cron actually ran, independent of whether Watchdog's own
-- health_checks currently considers it healthy. A cron whose VM
-- crontab entry silently stopped firing, or started erroring every
-- time, now shows up in /api/cron/health-check's next run instead of
-- just never being noticed.
--
-- Same "deliberately no policies at all" posture as health_checks/
-- app_settings — nothing needs to reach this through the
-- anon/authenticated API, only the cron routes themselves (service
-- role) and evaluateCronHeartbeat's read in checks.ts.
create table cron_heartbeats (
  name text primary key,
  last_run_at timestamptz not null,
  last_ok boolean not null,
  last_detail text
);
alter table cron_heartbeats enable row level security;
