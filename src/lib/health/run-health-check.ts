import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { runHealthChecks } from "./checks";
import { reconcileHealthChecks } from "./notify";
import { sendHealthAlertEmail } from "@/lib/email/send-health-emails";

type AnySupabaseClient = SupabaseClient<Database>;

export type RunHealthCheckSummary = { checks: { key: string; ok: boolean }[]; notified: number };

/**
 * The actual sweep — run every check, reconcile against persisted
 * state, email superadmins if anything crossed an edge. Shared by both
 * entry points that trigger it: the 15-minute crontab
 * (/api/cron/health-check) and the "Check now" button on the Watchdog
 * Phase 4 status page (/office/health) — split out so the two can
 * never drift out of sync with each other.
 */
export async function runHealthCheckSweep(supabase: AnySupabaseClient): Promise<RunHealthCheckSummary> {
  const results = await runHealthChecks(supabase);
  const notifyItems = await reconcileHealthChecks(supabase, results);

  let notified = 0;
  if (notifyItems.length > 0) {
    const { data: recipients, error: recipientsError } = await supabase
      .from("users")
      .select("email")
      .eq("role", "superadmin")
      .eq("active", true);
    if (recipientsError) throw recipientsError;

    await Promise.all((recipients ?? []).map((r) => sendHealthAlertEmail(r.email, notifyItems)));
    notified = recipients?.length ?? 0;
  }

  return { checks: results.map((r) => ({ key: r.key, ok: r.ok })), notified };
}
