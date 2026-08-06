"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { removeCalendarForJob } from "@/lib/google/sync-job-calendar";
import { createShareLinkForJob } from "@/lib/share-links/create";
import { appBaseUrl } from "@/lib/app-url";
import { duplicateJob } from "@/lib/jobs/duplicate-job";
import { cloneTasksForJob } from "@/lib/jobs/clone-tasks";
import type { ActionResult } from "../actions";

export async function raiseIssue(jobId: string, siteId: string, formData: FormData): Promise<ActionResult> {
  const severity = String(formData.get("severity") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  if (!severity || !description) return { ok: false, message: "Severity and description are required." };

  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Not signed in." };

  const blocksCompletion = formData.get("blocks_completion") === "true";

  const supabase = await createClient();
  const { error } = await supabase.from("issues").insert({
    job_id: jobId,
    site_id: siteId,
    raised_by: user.id,
    severity,
    description,
    blocks_completion: blocksCompletion,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/office/jobs/${jobId}`);
  return { ok: true, message: "Issue raised." };
}

/** Cancels a job and — per spec — deletes its calendar event and nulls calendar_event_id. */
export async function cancelJob(jobId: string, reason: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Not signed in." };

  const supabase = await createClient();
  const { data: job } = await supabase.from("jobs").select("status").eq("id", jobId).single();
  if (!job) return { ok: false, message: "Job not found." };

  const { error } = await supabase.from("jobs").update({ status: "cancelled" }).eq("id", jobId);
  if (error) return { ok: false, message: error.message };

  await supabase.from("status_events").insert({
    job_id: jobId,
    from_status: job.status,
    to_status: "cancelled",
    user_id: user.id,
    reason: reason.trim() || undefined,
  });

  // Best-effort and scheduled via after(), not awaited — see bulkScheduleJobs
  // in ../actions.ts for why a real Calendar API round trip shouldn't sit
  // between a manager clicking "Cancel" and seeing it take effect.
  after(() => removeCalendarForJob(supabase, jobId));

  revalidatePath(`/office/jobs/${jobId}`);
  revalidatePath("/office/jobs");
  revalidatePath("/office/scheduler");
  return { ok: true, message: "Job cancelled." };
}

export type CreateShareLinkResult = { ok: true; url: string; expiresAt: string } | { ok: false; message: string };

export async function createShareLink(jobId: string, expiresInDays: number): Promise<CreateShareLinkResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Not signed in." };

  const supabase = await createClient();
  const result = await createShareLinkForJob(supabase, jobId, user.id, expiresInDays);
  if ("error" in result) return { ok: false, message: result.error };

  revalidatePath(`/office/jobs/${jobId}`);
  return { ok: true, url: `${appBaseUrl()}/share/${result.token}`, expiresAt: result.expiresAt };
}

/** Revokes rather than deletes, so the row (and its audit trail — who created it, when) survives. */
export async function revokeShareLink(token: string, jobId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("share_links").update({ revoked: true }).eq("token", token);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/office/jobs/${jobId}`);
  return { ok: true, message: "Link revoked." };
}

export type DuplicateJobActionResult = { ok: true; newJobId: string } | { ok: false; message: string };

export async function duplicateJobAction(jobId: string): Promise<DuplicateJobActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Not signed in." };

  const supabase = await createClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("id, job_number, project_id, site_id, job_type, description")
    .eq("id", jobId)
    .single();
  if (!job) return { ok: false, message: "Job not found." };

  const result = await duplicateJob(supabase, job, user.id);
  if ("error" in result) return { ok: false, message: result.error };

  revalidatePath("/office/jobs");
  return { ok: true, newJobId: result.newJobId };
}

export type JobTaskRow = { id: string; label: string; is_done: boolean };
export type ApplyTemplateResult = { ok: true; tasks: JobTaskRow[] } | { ok: false; message: string };
export type AddJobTaskResult = { ok: true; task: JobTaskRow } | { ok: false; message: string };

/**
 * Applies a template's task list to a job, appending after any tasks the
 * job already has, and returns the inserted rows: the caller splices them
 * into local state directly rather than trusting router.refresh() to
 * deliver them, since this build's RSC refresh has proven to lag one
 * action behind under rapid sequential mutations (see DECISIONS.md).
 */
export async function applyTemplateToJob(jobId: string, templateId: string): Promise<ApplyTemplateResult> {
  const supabase = await createClient();
  const { data: templateTasks } = await supabase
    .from("job_template_tasks")
    .select("position, label")
    .eq("template_id", templateId)
    .order("position");
  if (!templateTasks || templateTasks.length === 0) return { ok: false, message: "That template has no tasks." };

  const { count: existingCount } = await supabase
    .from("job_tasks")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId);
  const offset = existingCount ?? 0;
  const rows = cloneTasksForJob(templateTasks, jobId).map((row) => ({ ...row, position: row.position + offset }));

  const { data, error } = await supabase.from("job_tasks").insert(rows).select("id, label, is_done");
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/office/jobs/${jobId}`);
  return { ok: true, tasks: data };
}

export async function addJobTask(jobId: string, label: string): Promise<AddJobTaskResult> {
  const trimmed = label.trim();
  if (!trimmed) return { ok: false, message: "Task label is required." };

  const supabase = await createClient();
  const { count } = await supabase.from("job_tasks").select("id", { count: "exact", head: true }).eq("job_id", jobId);

  const { data, error } = await supabase
    .from("job_tasks")
    .insert({ job_id: jobId, label: trimmed, position: count ?? 0 })
    .select("id, label, is_done")
    .single();
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/office/jobs/${jobId}`);
  return { ok: true, task: data };
}

export async function deleteJobTask(taskId: string, jobId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("job_tasks").delete().eq("id", taskId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/office/jobs/${jobId}`);
  return { ok: true, message: "Task removed." };
}

export async function toggleJobTask(taskId: string, jobId: string, isDone: boolean): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Not signed in." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("job_tasks")
    .update({ is_done: isDone, done_at: isDone ? new Date().toISOString() : null, done_by: isDone ? user.id : null })
    .eq("id", taskId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/office/jobs/${jobId}`);
  return { ok: true, message: isDone ? "Marked done." : "Marked not done." };
}
