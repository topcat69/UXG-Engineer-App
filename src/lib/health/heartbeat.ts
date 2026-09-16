import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type AnySupabaseClient = SupabaseClient<Database>;

/** The four existing cron routes' names, exactly as Watchdog's CRON_EXPECTATIONS (cron-heartbeat-logic.ts) and this file's own callers key them — one place so the two lists can't drift apart. */
export const CRON_NAMES = {
  dayBeforeReminders: "day-before-reminders",
  weeklySummary: "weekly-summary",
  mediaLifecycle: "media-lifecycle",
  driveMediaSync: "drive-media-sync",
} as const;

/**
 * Watchdog Phase 2: called at the end of every cron route invocation,
 * success or failure — the raw evidence that a cron actually ran.
 * Deliberately a separate table from health_checks: this is the raw
 * fact (did it run, did it error), not Watchdog's derived is-it-
 * healthy/when-was-it-last-notified state, which lives in
 * health_checks and is computed from this data by
 * evaluateCronHeartbeat (cron-heartbeat-logic.ts).
 *
 * Best-effort — same contract as every other integration in this app:
 * a heartbeat write failing must never fail the cron route itself, or
 * "log a heartbeat" would turn into "block reminders going out."
 * Logged so it's not silent, but that's all.
 */
export async function recordCronHeartbeat(
  supabase: AnySupabaseClient,
  name: (typeof CRON_NAMES)[keyof typeof CRON_NAMES],
  ok: boolean,
  detail: string,
): Promise<void> {
  const { error } = await supabase.from("cron_heartbeats").upsert({
    name,
    last_run_at: new Date().toISOString(),
    last_ok: ok,
    last_detail: detail,
  });
  if (error) console.error(`Watchdog: failed to record heartbeat for cron "${name}"`, error);
}
