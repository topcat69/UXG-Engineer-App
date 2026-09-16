import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSecret } from "@/lib/webhooks/verify-secret";
import { runHealthCheckSweep } from "@/lib/health/run-health-check";

/**
 * Watchdog Phase 1 (see the "Watchdog" scoping memo). Meant to be hit
 * every 15 minutes by the same external-scheduler pattern as the other
 * cron routes — see day-before-reminders' comment for why this is a
 * plain authenticated POST rather than a self-triggering one.
 *
 * Deliberately not wrapped in its own top-level try/catch the way the
 * best-effort integrations are: if this route itself throws (e.g. the
 * database is unreachable), that has to surface as a 500 rather than
 * being swallowed — this route existing at all is to stop failures
 * from going unnoticed, so it can't have its own silent-failure mode.
 * Note this also means the edge-triggered/cooldown logic in
 * reconcileHealthChecks can't run at all if the database itself is
 * down (it needs the database to persist state) — in that one
 * scenario, every 15-minute run failing outright *is* the correct
 * signal, not something to flood-control away.
 */
export async function POST(request: Request) {
  if (!verifyWebhookSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await runHealthCheckSweep(createAdminClient());
  return NextResponse.json(summary);
}
