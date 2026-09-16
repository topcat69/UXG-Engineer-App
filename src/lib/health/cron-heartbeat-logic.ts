import type { HealthCheckResult } from "./types";

export type CronHeartbeatRow = { last_run_at: string; last_ok: boolean; last_detail: string | null };
export type CronExpectation = { name: string; maxAgeMs: number };

/**
 * Watchdog Phase 2's four existing crons and how stale their heartbeat
 * is allowed to get before it's flagged — generous slack over each
 * cron's own cadence (documented in DECISIONS.md's "the cron routes
 * finally have a scheduler" addendum), not a tight deadline, since the
 * point is catching "this stopped running entirely," not paging over
 * ordinary timing jitter.
 */
export const CRON_EXPECTATIONS: CronExpectation[] = [
  { name: "day-before-reminders", maxAgeMs: 26 * 60 * 60 * 1000 }, // daily at 06:00 UTC
  { name: "weekly-summary", maxAgeMs: 8 * 24 * 60 * 60 * 1000 }, // Monday 07:00 UTC
  { name: "media-lifecycle", maxAgeMs: 26 * 60 * 60 * 1000 }, // daily at 02:30 UTC
  { name: "drive-media-sync", maxAgeMs: 45 * 60 * 1000 }, // every 15 minutes
];

/**
 * Pure decision for one cron's liveness: stale (older than its expected
 * cadence, with the slack above) or its own last run having errored
 * both count as unhealthy. A cron that has never recorded a heartbeat
 * at all — right after this shipped, or right after a fresh deploy,
 * before its next scheduled fire — is treated as healthy/unknown rather
 * than failing: absence isn't evidence of failure, just of "hasn't had
 * its first chance yet." Split out as a pure function for the same
 * reason as decideHealthCheckTransition: unit-testable without a live
 * database.
 */
export function evaluateCronHeartbeat(
  expectation: CronExpectation,
  row: CronHeartbeatRow | undefined,
  nowIso: string,
): HealthCheckResult {
  const key = `cron:${expectation.name}`;
  if (!row) return { key, ok: true, detail: "no heartbeat recorded yet" };

  const ageMs = new Date(nowIso).getTime() - new Date(row.last_run_at).getTime();
  if (ageMs > expectation.maxAgeMs) {
    return {
      key,
      ok: false,
      detail: `last ran ${row.last_run_at}, expected within ${Math.round(expectation.maxAgeMs / 60_000)} min`,
    };
  }
  if (!row.last_ok) {
    return { key, ok: false, detail: `run at ${row.last_run_at} failed: ${row.last_detail ?? "unknown error"}` };
  }
  return { key, ok: true, detail: `last ran ${row.last_run_at}` };
}
