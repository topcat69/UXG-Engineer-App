import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSecret } from "@/lib/webhooks/verify-secret";
import { runHealthChecks } from "@/lib/health/checks";
import { reconcileHealthChecks } from "@/lib/health/notify";
import { sendHealthAlertEmail } from "@/lib/email/send-health-emails";

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

  const supabase = createAdminClient();
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

  return NextResponse.json({
    checks: results.map((r) => ({ key: r.key, ok: r.ok })),
    notified,
  });
}
