"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { nextJobNumber } from "@/lib/jobs/job-number";
import type { ActionResult } from "../jobs/actions";

export async function approveJob(jobId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Not signed in." };

  const supabase = await createClient();
  const { data: job } = await supabase.from("jobs").select("status").eq("id", jobId).single();
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

  revalidatePath("/office/qa");
  revalidatePath(`/office/jobs/${jobId}`);
  return { ok: true, message: "Approved and closed." };
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

  const { error: rejectError } = await supabase
    .from("jobs")
    .update({ qa_status: "rejected", qa_notes: reason })
    .eq("id", jobId);
  if (rejectError) return { ok: false, message: rejectError.message };

  // Reject -> Revisit: create a linked follow-up job, per the AppSheet action
  // spec. The rejected job's own `status` doesn't change (qa_status does) —
  // it stays as the historical record of what was reviewed and rejected.
  const { count } = await supabase.from("jobs").select("id", { count: "exact", head: true });
  const { data: revisit, error: revisitError } = await supabase
    .from("jobs")
    .insert({
      job_number: nextJobNumber(count ?? 0, new Date().getFullYear(), 1),
      project_id: job.project_id,
      site_id: job.site_id,
      job_type: job.job_type,
      status: "draft",
      parent_job_id: jobId,
    })
    .select("id")
    .single();
  if (revisitError) return { ok: false, message: revisitError.message };

  await supabase.from("status_events").insert({
    job_id: revisit.id,
    from_status: null,
    to_status: "draft",
    user_id: user.id,
    reason: `Revisit created from ${job.job_number} (rejected: ${reason})`,
  });

  revalidatePath("/office/qa");
  revalidatePath("/office/jobs");
  revalidatePath(`/office/jobs/${jobId}`);
  return { ok: true, message: `Rejected. Revisit ${revisit ? "created" : ""}.` };
}
