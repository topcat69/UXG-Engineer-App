"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createRevisitJob } from "@/lib/jobs/create-revisit";
import { sendApprovedEmail } from "@/lib/email/send-job-emails";
import { generateAndStoreCompletionReport } from "@/lib/pdf/completion-report";
import type { ActionResult } from "../jobs/actions";

export async function approveJob(jobId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Not signed in." };

  const supabase = await createClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("status, site:sites(contact_email, contact_name)")
    .eq("id", jobId)
    .single();
  if (!job) return { ok: false, message: "Job not found." };

  const { error } = await supabase.from("jobs").update({ qa_status: "approved", status: "closed" }).eq("id", jobId);
  if (error) return { ok: false, message: error.message };

  await supabase.from("status_events").insert({
    job_id: jobId,
    from_status: job.status,
    to_status: "closed",
    user_id: user.id,
    reason: "QA approved",
  });

  // Generated synchronously here (not queued) — approval is a deliberate,
  // infrequent office action, not a hot path, so making the office user
  // wait a couple of seconds for the report is a reasonable tradeoff for
  // not needing a background job queue. A report failure doesn't undo the
  // approval itself, matching the "downstream integration never blocks the
  // core action" contract used throughout this app; it does still show up
  // in the returned message so the office user knows to retry.
  const report = await generateAndStoreCompletionReport(supabase, jobId);
  let reportNote = "";
  if ("path" in report) {
    await supabase.from("jobs").update({ completion_pdf_url: report.path }).eq("id", jobId);
  } else {
    reportNote = ` Report generation failed: ${report.error}`;
  }

  // Best-effort, per sendApprovedEmail's own contract — sites without a
  // contact_email on file just don't get one; that's not a QA failure.
  if (job.site?.contact_email) {
    await sendApprovedEmail(supabase, jobId, job.site.contact_email, job.site.contact_name ?? "there");
  }

  revalidatePath("/office/qa");
  revalidatePath(`/office/jobs/${jobId}`);
  return { ok: true, message: `Approved and closed.${reportNote}` };
}

export async function rejectJob(jobId: string, reason: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Not signed in." };
  if (!reason.trim()) return { ok: false, message: "A reason is required to reject." };

  const supabase = await createClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("job_number, status, project_id, site_id, job_type")
    .eq("id", jobId)
    .single();
  if (!job) return { ok: false, message: "Job not found." };

  // status moves to "revisit" too, not just qa_status — the redo happens on
  // a brand new linked job (below), so the original is genuinely done, not
  // back in play. Distinct from "closed": it reads as "closed, but because
  // it got redone" rather than "closed, approved" — and it drops out of
  // the job review queue (which lists submitted/under_review) and the
  // engineer's own queue the same way closed/cancelled jobs do.
  const { error: rejectError } = await supabase
    .from("jobs")
    .update({ status: "revisit", qa_status: "rejected", qa_notes: reason })
    .eq("id", jobId);
  if (rejectError) return { ok: false, message: rejectError.message };

  await supabase.from("status_events").insert({
    job_id: jobId,
    from_status: job.status,
    to_status: "revisit",
    user_id: user.id,
    reason: `QA rejected: ${reason}`,
  });

  // Reject -> Revisit: create a linked follow-up job, per the AppSheet action
  // spec — parent_job_id ties the two together so the rejection is
  // traceable from either job (see the "Revisit of ..." / "Revisit created: ..."
  // links on the job detail page).
  const revisit = await createRevisitJob(
    supabase,
    { id: jobId, job_number: job.job_number, project_id: job.project_id, site_id: job.site_id, job_type: job.job_type },
    `rejected: ${reason}`,
    user.id,
  );
  if ("error" in revisit) return { ok: false, message: revisit.error };

  revalidatePath("/office/qa");
  revalidatePath("/office/jobs");
  revalidatePath(`/office/jobs/${jobId}`);
  return { ok: true, message: "Rejected and closed as a revisit. New revisit job created." };
}
