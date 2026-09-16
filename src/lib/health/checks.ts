import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type AnySupabaseClient = SupabaseClient<Database>;

export type HealthCheckResult = { key: string; ok: boolean; detail: string };

/**
 * Watchdog Phase 1 (see the "Watchdog" scoping memo): database
 * reachability and schema drift — the two checks that predate any
 * cron/integration instrumentation (Phases 2/3) and are the ones that
 * would have actually caught this week's real incident, a migration
 * that never reached production and read as "nothing to sync" instead
 * of failing loudly.
 */
export async function runHealthChecks(supabase: AnySupabaseClient): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = [];

  const { error: dbError } = await supabase.from("clients").select("id").limit(1);
  results.push(
    dbError ? { key: "db", ok: false, detail: dbError.message } : { key: "db", ok: true, detail: "reachable" },
  );

  // check_expected_columns() (20260916010000_watchdog_health_checks.sql)
  // is deliberately extended by every future migration that adds a
  // column the app depends on — the migration and its own health check
  // land in the same commit.
  const { data: missing, error: schemaError } = await supabase.rpc("check_expected_columns");
  if (schemaError) {
    results.push({ key: "schema", ok: false, detail: schemaError.message });
  } else if (missing && missing.length > 0) {
    results.push({ key: "schema", ok: false, detail: `Missing column(s): ${missing.join(", ")}` });
  } else {
    results.push({ key: "schema", ok: true, detail: "all expected columns present" });
  }

  return results;
}
