-- Watchdog Phase 3 (see the "Watchdog" scoping memo): one row per
-- failed attempt by a best-effort integration (Drive, Calendar, Resend,
-- Monday.com) — written alongside the console.error that's already in
-- each integration's own catch block, by recordIntegrationFailure
-- (lib/health/integration-failures.ts). An append-only log rather than
-- a single "last failure" row, since the check that reads this
-- (checkIntegrationFailures, checks.ts) needs a count within a lookback
-- window to tell "failed repeatedly" apart from "one transient blip" —
-- the whole point of the threshold being more than one.
--
-- Same "deliberately no policies at all" posture as health_checks/
-- cron_heartbeats/app_settings — nothing needs to reach this through
-- the anon/authenticated API. recordIntegrationFailure always writes
-- via the service-role client regardless of which client its caller
-- happens to be running as (an office server action's RLS-scoped
-- client couldn't write here otherwise).
create table integration_failures (
  id uuid primary key default gen_random_uuid(),
  integration text not null,
  detail text,
  occurred_at timestamptz not null default now()
);
alter table integration_failures enable row level security;

-- checkIntegrationFailures' read is "count rows for these integrations
-- newer than X" every 15 minutes — this is exactly the access pattern
-- this index serves.
create index integration_failures_integration_occurred_at_idx on integration_failures (integration, occurred_at);
