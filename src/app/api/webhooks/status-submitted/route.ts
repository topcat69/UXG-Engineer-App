import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSubmittedEmail } from "@/lib/email/send-job-emails";
import { verifyWebhookSecret } from "@/lib/webhooks/verify-secret";

/**
 * Called by the status_events "submitted" trigger (pg_net, see
 * supabase/migrations/20260109000000_status_submitted_webhook.sql) rather
 * than any browser session — the field app writes status_events directly
 * via PostgREST, so this route is the only reliable place to notice a
 * submission and email the managers, regardless of whether it came from
 * the office UI or an offline sync. Authenticated by a shared secret
 * header, not Supabase auth, since Postgres has no user session to send.
 */
export async function POST(request: Request) {
  if (!verifyWebhookSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { job_id?: string };
  if (!body.job_id) return NextResponse.json({ error: "Missing job_id" }, { status: 400 });

  const supabase = createAdminClient();
  const { data: managers } = await supabase
    .from("users")
    .select("email, name")
    .in("role", ["superadmin", "manager"])
    .eq("active", true);

  // Fan out to every active manager/superadmin — there's no single
  // designated "the manager" for a job in this schema.
  await Promise.all(
    (managers ?? []).map((manager) => sendSubmittedEmail(supabase, body.job_id!, manager.email, manager.name)),
  );

  return NextResponse.json({ notified: managers?.length ?? 0 });
}
