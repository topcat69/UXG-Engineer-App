import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type IntegrationName = "drive" | "calendar" | "resend" | "monday";

/**
 * Watchdog Phase 3: called alongside the console.error that's already
 * in each of these integrations' best-effort catch blocks — the raw
 * evidence a configured integration actually failed, read back by
 * checkIntegrationFailures (checks.ts) to tell "failed repeatedly"
 * apart from "one transient blip" (see FAILURE_THRESHOLD there).
 *
 * Deliberately creates its own service-role client rather than taking
 * one from the caller: several of these catch blocks (the office
 * server actions around scheduling/assignment emails) only ever have
 * the request-scoped, RLS-bound client in hand, which couldn't write
 * here anyway — integration_failures has no policies, same posture as
 * health_checks/cron_heartbeats. Best-effort itself: a failure
 * recording its own failure must never throw back into the
 * integration's own catch block, so this only logs if the insert
 * itself fails.
 */
export async function recordIntegrationFailure(integration: IntegrationName, detail: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("integration_failures").insert({ integration, detail });
  if (error) console.error(`Watchdog: failed to record integration failure for "${integration}"`, error);
}
