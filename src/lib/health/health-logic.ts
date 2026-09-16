import type { HealthCheckResult } from "./checks";

export type NotifyItem = { key: string; kind: "new_failure" | "still_failing" | "recovered"; detail: string };

export type PreviousHealthRow = {
  is_healthy: boolean;
  last_ok_at: string | null;
  last_fail_at: string | null;
  last_notified_at: string | null;
};

export type HealthRowUpdate = {
  key: string;
  is_healthy: boolean;
  last_detail: string;
  last_ok_at: string | null;
  last_fail_at: string | null;
  last_notified_at: string | null;
  updated_at: string;
};

/** See the Watchdog scoping memo's anti-flood section: one reminder every 4h while a check stays bad, never one per 15-minute run. */
export const REMINDER_COOLDOWN_MS = 4 * 60 * 60 * 1000;

/**
 * Pure decision for one check: compares its new result against the
 * previously-persisted row (undefined when the check has never run
 * before) and decides both what to write back and whether it's worth
 * telling anyone. Edge-triggered — healthy -> bad and bad -> healthy —
 * plus the capped reminder while something stays bad. Split out from
 * reconcileHealthChecks (notify.ts) so this, the actual anti-flood
 * logic, is unit-testable without a live database — same split as
 * sync-logic.ts/sync-job-calendar.ts for Calendar sync.
 */
export function decideHealthCheckTransition(
  result: HealthCheckResult,
  previous: PreviousHealthRow | undefined,
  nowIso: string,
): { notify: NotifyItem | null; row: HealthRowUpdate } {
  // No row yet means this check has never run before — treated as
  // "previously healthy" so a check that's already bad on its very
  // first run still correctly counts as crossing the healthy -> bad
  // edge, rather than being missed as "no change."
  const wasHealthy = previous?.is_healthy ?? true;

  const crossedToBad = !result.ok && wasHealthy;
  const crossedToGood = result.ok && !wasHealthy;
  const reminderDue =
    !result.ok &&
    !wasHealthy &&
    (!previous?.last_notified_at || new Date(nowIso).getTime() - new Date(previous.last_notified_at).getTime() >= REMINDER_COOLDOWN_MS);

  let notify: NotifyItem | null = null;
  if (crossedToBad || reminderDue) {
    notify = { key: result.key, kind: crossedToBad ? "new_failure" : "still_failing", detail: result.detail };
  } else if (crossedToGood) {
    notify = { key: result.key, kind: "recovered", detail: result.detail };
  }

  const row: HealthRowUpdate = {
    key: result.key,
    is_healthy: result.ok,
    last_detail: result.detail,
    last_ok_at: result.ok ? nowIso : previous?.last_ok_at ?? null,
    last_fail_at: result.ok ? previous?.last_fail_at ?? null : nowIso,
    last_notified_at: notify ? nowIso : previous?.last_notified_at ?? null,
    updated_at: nowIso,
  };

  return { notify, row };
}
