import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSecret } from "@/lib/webhooks/verify-secret";
import { nextJobNumber } from "@/lib/jobs/job-number";
import { maxJobSequenceForYear } from "@/lib/jobs/next-job-number";

type DispatchBody = {
  ticketId?: string;
  ticketNumber?: number;
  siteId?: string;
  title?: string;
  details?: string | null;
  priority?: "P1" | "P2" | "P3" | "P4";
};

/**
 * Called by Service Desk's "Dispatch to engineer" action on an in-house
 * ticket — the only direction tickets currently flow into this app (see
 * the ticket detail page's dispatch control). Creates a `jobs` row the
 * same way the office's own SLA flow does (office/sla/actions.ts's
 * createSlaJob) — job_type "sla", no project — except there's no
 * fixture_type_id yet, since Service Desk doesn't know this customer's
 * registered fixture types; whoever works the job fills that in from the
 * site, same as any job that didn't go through the dedicated SLA form.
 *
 * Idempotent on source_ticket_id: Service Desk may retry this call (e.g.
 * on a timeout) without knowing whether the first attempt actually landed,
 * so a second call for the same ticket returns the existing job rather
 * than creating a duplicate.
 */
export async function POST(request: Request) {
  if (!verifyWebhookSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as DispatchBody;
  if (!body.ticketId) return NextResponse.json({ error: "Missing ticketId" }, { status: 400 });
  if (!body.siteId) return NextResponse.json({ error: "Missing siteId" }, { status: 400 });

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("jobs")
    .select("id, job_number")
    .eq("source_ticket_id", body.ticketId)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ jobId: existing.id, jobNumber: existing.job_number });
  }

  const { data: site, error: siteError } = await supabase.from("sites").select("id").eq("id", body.siteId).maybeSingle();
  if (siteError || !site) return NextResponse.json({ error: "Unknown siteId" }, { status: 400 });

  const year = new Date().getFullYear();
  const maxSeq = await maxJobSequenceForYear(supabase, year);
  const description = body.ticketNumber
    ? `Dispatched from Service Desk ticket #${body.ticketNumber}: ${body.title ?? ""}`.trim()
    : `Dispatched from Service Desk: ${body.title ?? ""}`.trim();

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      job_number: nextJobNumber(maxSeq, year, 1),
      project_id: null,
      site_id: body.siteId,
      job_type: "sla",
      status: "draft",
      priority: body.priority ?? "P3",
      description,
      source_ticket_id: body.ticketId,
    })
    .select("id, job_number")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // The ticket's own "Details"/"Description" field (the actual reported
  // problem, not just the title) — carried onto the same field the office
  // fills in by hand for a manually-created SLA job (see
  // office/jobs/[id]/actions.ts's updateSlaRequirement), so the engineer
  // sees it the same way either path got here. Best-effort: a failure
  // here shouldn't undo an already-created job.
  if (body.details) {
    await supabase
      .from("job_details")
      .upsert({ job_id: job.id, sla_requirement_detail: body.details }, { onConflict: "job_id" });
  }

  return NextResponse.json({ jobId: job.id, jobNumber: job.job_number });
}
