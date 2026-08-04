import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRevisitJob } from "@/lib/jobs/create-revisit";
import { verifyWebhookSecret } from "@/lib/webhooks/verify-secret";

/**
 * Called by the issues "blocks_completion" trigger (pg_net, see
 * supabase/migrations/20260112000000_issue_blocks_completion_webhook.sql).
 * Issues raised from the field app land here via the outbox's
 * issue_insert op going straight to PostgREST — no Next.js server action
 * in that path — so, same as Phase 4's status-submitted webhook, the
 * database itself is the only reliable place to notice one and react.
 */
export async function POST(request: Request) {
  if (!verifyWebhookSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { issue_id?: string };
  if (!body.issue_id) return NextResponse.json({ error: "Missing issue_id" }, { status: 400 });

  const supabase = createAdminClient();
  const { data: issue } = await supabase
    .from("issues")
    .select("id, description, revisit_job_id, job:jobs!issues_job_id_fkey(id, job_number, project_id, site_id, job_type)")
    .eq("id", body.issue_id)
    .single();
  if (!issue?.job) return NextResponse.json({ error: "Issue or parent job not found" }, { status: 404 });
  if (issue.revisit_job_id) return NextResponse.json({ skipped: "already linked" });

  const result = await createRevisitJob(supabase, issue.job, `issue: ${issue.description}`, null);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 500 });

  await supabase.from("issues").update({ revisit_job_id: result.revisitId }).eq("id", issue.id);

  return NextResponse.json({ revisitId: result.revisitId });
}
