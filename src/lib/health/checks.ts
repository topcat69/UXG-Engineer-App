import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { HealthCheckResult } from "./types";
import { CRON_EXPECTATIONS, evaluateCronHeartbeat } from "./cron-heartbeat-logic";
import { FAILURE_LOOKBACK_MS, evaluateIntegrationFailureCount } from "./integration-failure-logic";
import { customerJobsRootFolderId } from "@/lib/google/drive-folders";
import { getCalendarClient } from "@/lib/google/calendar";
import { isResendConfigured } from "@/lib/email/resend";
import { isMondayConfigured } from "@/lib/monday/client";

type AnySupabaseClient = SupabaseClient<Database>;

export type { HealthCheckResult };

/**
 * Watchdog Phase 1: database reachability and schema drift — the two
 * checks that predate any cron/integration instrumentation and are the
 * ones that would have actually caught this week's real incident, a
 * migration that never reached production and read as "nothing to
 * sync" instead of failing loudly.
 */
async function checkDatabase(supabase: AnySupabaseClient): Promise<HealthCheckResult> {
  const { error } = await supabase.from("clients").select("id").limit(1);
  return error ? { key: "db", ok: false, detail: error.message } : { key: "db", ok: true, detail: "reachable" };
}

/**
 * check_expected_columns() (20260916010000_watchdog_health_checks.sql)
 * is deliberately extended by every future migration that adds a
 * column the app depends on — the migration and its own health check
 * land in the same commit.
 */
async function checkSchema(supabase: AnySupabaseClient): Promise<HealthCheckResult> {
  const { data: missing, error } = await supabase.rpc("check_expected_columns");
  if (error) return { key: "schema", ok: false, detail: error.message };
  if (missing && missing.length > 0) return { key: "schema", ok: false, detail: `Missing column(s): ${missing.join(", ")}` };
  return { key: "schema", ok: true, detail: "all expected columns present" };
}

/**
 * Watchdog Phase 2: did the four existing cron routes actually run
 * recently — see cron-heartbeat-logic.ts for the per-cron cadence and
 * the "never run yet" -> healthy/unknown decision. One query for all
 * four rather than one each, since they're always checked together.
 */
async function checkCronHeartbeats(supabase: AnySupabaseClient): Promise<HealthCheckResult[]> {
  const { data: rows, error } = await supabase
    .from("cron_heartbeats")
    .select("name, last_run_at, last_ok, last_detail")
    .in(
      "name",
      CRON_EXPECTATIONS.map((c) => c.name),
    );
  if (error) {
    // The whole category fails together rather than guessing per-cron —
    // if this query itself fails, nothing can be said about any of them.
    return CRON_EXPECTATIONS.map((c) => ({ key: `cron:${c.name}`, ok: false, detail: error.message }));
  }
  const byName = new Map((rows ?? []).map((row) => [row.name, row]));
  const nowIso = new Date().toISOString();
  return CRON_EXPECTATIONS.map((expectation) => evaluateCronHeartbeat(expectation, byName.get(expectation.name), nowIso));
}

/**
 * Watchdog Phase 3: is a *configured* integration actually failing.
 * Drive/Calendar/Resend/Monday.com each already degrade to a no-op
 * when unconfigured (returns null/skipped, never throws) — that's a
 * deliberate setting, not a fault, so an integration that isn't
 * configured at all is left out of the results entirely rather than
 * reported as either healthy or unhealthy. For the ones that are
 * configured, evaluateIntegrationFailureCount (integration-failure-
 * logic.ts) decides "failed repeatedly" from the count recorded by
 * recordIntegrationFailure.
 */
async function checkIntegrationFailures(supabase: AnySupabaseClient): Promise<HealthCheckResult[]> {
  const configured = [
    { key: "drive", isConfigured: customerJobsRootFolderId() !== null },
    { key: "calendar", isConfigured: getCalendarClient() !== null },
    { key: "resend", isConfigured: isResendConfigured() },
    { key: "monday", isConfigured: isMondayConfigured() },
  ].filter((integration) => integration.isConfigured);
  if (configured.length === 0) return [];

  const sinceIso = new Date(Date.now() - FAILURE_LOOKBACK_MS).toISOString();
  const { data: rows, error } = await supabase
    .from("integration_failures")
    .select("integration")
    .in(
      "integration",
      configured.map((c) => c.key),
    )
    .gte("occurred_at", sinceIso);
  if (error) {
    // The whole category fails together — if this query itself fails,
    // nothing can be said about any configured integration's own state.
    return configured.map((c) => ({ key: `integration:${c.key}`, ok: false, detail: error.message }));
  }

  const counts = new Map<string, number>();
  for (const row of rows ?? []) counts.set(row.integration, (counts.get(row.integration) ?? 0) + 1);
  return configured.map((c) => evaluateIntegrationFailureCount(c.key, counts.get(c.key) ?? 0));
}

export async function runHealthChecks(supabase: AnySupabaseClient): Promise<HealthCheckResult[]> {
  const [db, schema, cronHeartbeats, integrationFailures] = await Promise.all([
    checkDatabase(supabase),
    checkSchema(supabase),
    checkCronHeartbeats(supabase),
    checkIntegrationFailures(supabase),
  ]);
  return [db, schema, ...cronHeartbeats, ...integrationFailures];
}
