/** Shared across checks.ts, health-logic.ts, and cron-heartbeat-logic.ts — kept in its own file so none of them has to import from another to get it. */
export type HealthCheckResult = { key: string; ok: boolean; detail: string };
