"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { removeCalendarForJob } from "@/lib/google/sync-job-calendar";
import { deleteJobCalendarEvent } from "@/lib/google/calendar";
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

/**
 * Hard-deletes a job outright — distinct from cancelJob above, which only
 * changes status and leaves the row (and its history) in place. This is
 * for removing a job created by mistake, so it's irreversible: the row and
 * everything that belongs to it (issues, media, forms, status history,
 * share links, tasks) cascade-deletes with it (see
 * supabase/migrations/20260115000000_superadmin_role_and_job_delete.sql).
 * A revisit job's `parent_job_id` and an issue's `revisit_job_id` pointing
 * at this job are cleared rather than cascading further.
 */
export async function deleteJobAction(jobId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Not signed in." };

  const supabase = await createClient();
  // removeCalendarForJob reads calendar_event_id off the jobs row itself,
  // so it has to run — or at least capture that id — before the row is
  // gone; captured here and passed to deleteJobCalendarEvent directly
  // rather than the DB-row-nulling helper, since there's no row left to null it on.
  const { data: job } = await supabase.from("jobs").select("calendar_event_id").eq("id", jobId).single();
  const calendarEventId = job?.calendar_event_id ?? null;

  const { error } = await supabase.from("jobs").delete().eq("id", jobId);
  if (error) return { ok: false, message: error.message };

  // Best-effort, scheduled via after() rather than awaited — same reasoning
  // as cancelJob above: a Calendar API round trip shouldn't sit between the
  // manager confirming delete and the UI reflecting it.
  if (calendarEventId) after(() => deleteJobCalendarEvent(calendarEventId));

  revalidatePath("/office/jobs");
  return { ok: true, message: "Job deleted." };
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

/**
 * Uploads RAMS or a site plan document (office-prepared reference material
 * for the field app's "Info on system" section, see 20260117000000_job_details.sql)
 * and points job_details' matching *_storage_path column at it. Reuses the
 * existing 'media' bucket / jobs/{job_id}/{filename} path convention (see
 * media-capture.ts) rather than a new bucket — same storage policies apply.
 */
export async function uploadJobDocument(
  jobId: string,
  kind: "rams" | "site_plan",
  formData: FormData,
): Promise<ActionResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose a file first." };

  const supabase = await createClient();
  const extension = file.name.split(".").pop() ?? "pdf";
  const storagePath = `jobs/${jobId}/${kind}-${Date.now()}.${extension}`;

  const { error: uploadError } = await supabase.storage.from("media").upload(storagePath, file, {
    contentType: file.type || undefined,
  });
  if (uploadError) return { ok: false, message: uploadError.message };

  const patch = kind === "rams" ? { rams_storage_path: storagePath } : { site_plan_storage_path: storagePath };
  const { error } = await supabase.from("job_details").upsert({ job_id: jobId, ...patch }, { onConflict: "job_id" });
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/office/jobs/${jobId}`);
  return { ok: true, message: `${kind === "rams" ? "RAMS" : "Site plan"} uploaded.` };
}

export async function updateSlaRequirement(jobId: string, detail: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("job_details")
    .upsert({ job_id: jobId, sla_requirement_detail: detail.trim() || null }, { onConflict: "job_id" });
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/office/jobs/${jobId}`);
  return { ok: true, message: "Saved." };
}

export type JobEquipmentRow = { id: string; model: string; serial: string | null };
export type AddEquipmentResult = { ok: true; item: JobEquipmentRow } | { ok: false; message: string };

export async function addJobEquipment(jobId: string, model: string, serial: string): Promise<AddEquipmentResult> {
  const trimmedModel = model.trim();
  if (!trimmedModel) return { ok: false, message: "Model is required." };

  const supabase = await createClient();
  const { count } = await supabase.from("job_equipment").select("id", { count: "exact", head: true }).eq("job_id", jobId);
  const { data, error } = await supabase
    .from("job_equipment")
    .insert({ job_id: jobId, model: trimmedModel, serial: serial.trim() || null, position: count ?? 0 })
    .select("id, model, serial")
    .single();
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/office/jobs/${jobId}`);
  return { ok: true, item: data };
}

export async function deleteJobEquipment(itemId: string, jobId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("job_equipment").delete().eq("id", itemId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/office/jobs/${jobId}`);
  return { ok: true, message: "Removed." };
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
