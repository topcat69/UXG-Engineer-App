import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendDayBeforeEmail } from "@/lib/email/send-job-emails";
import { isScheduledForTomorrow } from "@/lib/email/day-before";
import { verifyWebhookSecret } from "@/lib/webhooks/verify-secret";

/**
 * Meant to be hit once a day by an external scheduler — this sandbox has no
 * persistent cron infrastructure of its own (no pg_cron job installed, no
 * platform cron), so it's a plain authenticated route rather than a
 * self-triggering one. In production this is one line in Vercel Cron
 * (vercel.json's `crons`) or a pg_cron job calling pg_net the same way the
 * status-submitted webhook does — either points here, POST, with the
 * X-Webhook-Secret header set.
 */
export async function POST(request: Request) {
  if (!verifyWebhookSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, scheduled_start")
    .not("scheduled_start", "is", null)
    .not("assigned_to", "is", null)
    .not("status", "in", "(draft,cancelled,closed)");

  const now = new Date().toISOString();
  const dueJobs = (jobs ?? []).filter((job) => isScheduledForTomorrow(job.scheduled_start!, now));

  await Promise.all(dueJobs.map((job) => sendDayBeforeEmail(supabase, job.id)));

  return NextResponse.json({ sent: dueJobs.length });
}
