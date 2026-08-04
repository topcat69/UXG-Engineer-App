import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWeeklySummaryEmail } from "@/lib/email/send-job-emails";
import { countWeekJobs } from "@/lib/email/weekly-summary";
import { verifyWebhookSecret } from "@/lib/webhooks/verify-secret";

/** Same "external scheduler hits this weekly" contract as day-before-reminders — see that route's comment. */
export async function POST(request: Request) {
  if (!verifyWebhookSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const weekEnd = new Date();
  const weekStart = new Date(weekEnd);
  weekStart.setUTCDate(weekStart.getUTCDate() - 7);
  const weekLabel = `${weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${weekEnd.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;

  const [{ data: projects }, { data: managers }] = await Promise.all([
    supabase.from("projects").select("id, name").eq("status", "active"),
    supabase.from("users").select("email").in("role", ["admin", "manager"]).eq("active", true),
  ]);

  const recipients = (managers ?? []).map((m) => m.email);
  let sent = 0;

  for (const project of projects ?? []) {
    const [{ data: weekJobs }, { count: openIssueCount }] = await Promise.all([
      supabase
        .from("jobs")
        .select("status")
        .eq("project_id", project.id)
        .gte("scheduled_start", weekStart.toISOString())
        .lt("scheduled_start", weekEnd.toISOString()),
      supabase
        .from("issues")
        .select("id, job:jobs!inner(project_id)", { count: "exact", head: true })
        .eq("job.project_id", project.id)
        .eq("status", "open"),
    ]);

    const { completedCount, scheduledCount } = countWeekJobs((weekJobs ?? []).map((j) => j.status));
    if (completedCount === 0 && scheduledCount === 0 && !openIssueCount) continue;

    for (const email of recipients) {
      await sendWeeklySummaryEmail(email, project.name, project.id, weekLabel, {
        completedCount,
        scheduledCount,
        openIssueCount: openIssueCount ?? 0,
      });
      sent++;
    }
  }

  return NextResponse.json({ sent });
}
