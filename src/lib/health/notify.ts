import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { HealthCheckResult } from "./checks";
import { decideHealthCheckTransition, type NotifyItem } from "./health-logic";

type AnySupabaseClient = SupabaseClient<Database>;

export type { NotifyItem };

/**
 * Thin I/O wrapper around decideHealthCheckTransition (health-logic.ts,
 * where the actual edge-triggered/cooldown decision lives and is unit
 * tested): fetches each check's previous row, decides, and persists the
 * new state regardless of whether it's notify-worthy, so the next run
 * always has an accurate "previous" to compare against.
 */
export async function reconcileHealthChecks(
  supabase: AnySupabaseClient,
  results: HealthCheckResult[],
): Promise<NotifyItem[]> {
  const { data: previousRows, error: selectError } = await supabase
    .from("health_checks")
    .select("key, is_healthy, last_ok_at, last_fail_at, last_notified_at")
    .in(
      "key",
      results.map((r) => r.key),
    );
  if (selectError) throw selectError;
  const previousByKey = new Map((previousRows ?? []).map((row) => [row.key, row]));

  const nowIso = new Date().toISOString();
  const notifyItems: NotifyItem[] = [];

  for (const result of results) {
    const { notify, row } = decideHealthCheckTransition(result, previousByKey.get(result.key), nowIso);
    if (notify) notifyItems.push(notify);

    const { error: upsertError } = await supabase.from("health_checks").upsert(row);
    if (upsertError) throw upsertError;
  }

  return notifyItems;
}
