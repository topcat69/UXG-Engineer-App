import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { HealthCheckResult } from "./types";
import { CRON_EXPECTATIONS, evaluateCronHeartbeat } from "./cron-heartbeat-logic";

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

export async function runHealthChecks(supabase: AnySupabaseClient): Promise<HealthCheckResult[]> {
  const [db, schema, cronHeartbeats] = await Promise.all([
    checkDatabase(supabase),
    checkSchema(supabase),
    checkCronHeartbeats(supabase),
  ]);
  return [db, schema, ...cronHeartbeats];
}
