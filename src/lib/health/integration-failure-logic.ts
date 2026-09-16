import type { HealthCheckResult } from "./types";

/** See the Watchdog scoping memo: "failed repeatedly," not once — a single transient blip (a rate limit, a dropped connection) shouldn't page anyone. */
export const FAILURE_THRESHOLD = 3;
export const FAILURE_LOOKBACK_MS = 60 * 60 * 1000;
export const FAILURE_LOOKBACK_LABEL = "hour";

/**
 * Pure decision for one integration: unhealthy once its failure count
 * within the lookback window reaches the threshold above. Split out
 * for the same reason as decideHealthCheckTransition/
 * evaluateCronHeartbeat: the actual judgment call (how many is "too
 * many") is unit-testable without a live database; checkIntegrationFailures
 * (checks.ts) only does the counting query and calls this.
 */
export function evaluateIntegrationFailureCount(integration: string, count: number): HealthCheckResult {
  const key = `integration:${integration}`;
  if (count >= FAILURE_THRESHOLD) {
    return { key, ok: false, detail: `${count} failures in the last ${FAILURE_LOOKBACK_LABEL}` };
  }
  return {
    key,
    ok: true,
    detail: count > 0 ? `${count} failure(s) in the last ${FAILURE_LOOKBACK_LABEL}, below the alert threshold` : "no recent failures",
  };
}
