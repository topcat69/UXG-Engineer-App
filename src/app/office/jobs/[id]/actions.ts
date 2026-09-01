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
import { detectConflicts } from "@/lib/scheduler/conflicts";
import { syncCalendarForJob } from "@/lib/google/sync-job-calendar";
import { sendJobAssignedEmail, sendJobCancelledEmail, sendJobScheduledEmail } from "@/lib/email/send-job-emails";
import type { RequirableFieldKey } from "@/lib/forms/job-form";
import type { ActionResult } from "../actions";

/**
 * Edits the core static fields a job was created with — project, site,
 * job type, priority, description, QuickBooks No. (the purchase order
 * reference). Same validation as createJob (project/site/job type all
 * required); priority/description/quickbooks_no are free-form and
 * optional. No status gating — deliberately not blocked once a job is
 * past draft, since restricting that is a design call beyond what was
 * asked for and would just get in an office user's way if they need to
 * correct a genuine mistake after the fact.
 */
export async function updateJob(
  jobId: string,
  input: {
    project_id: string;
    site_id: string;
    job_type: string;
    priority: string;
    description: string;
    quickbooks_no: string;
  },
): Promise<ActionResult> {
  if (!input.project_id) return { ok: false, message: "Select a project." };
  if (!input.site_id) return { ok: false, message: "Select a site." };
  if (!input.job_type) return { ok: false, message: "Select a job type." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("jobs")
    .update({
      project_id: input.project_id,
      site_id: input.site_id,
      job_type: input.job_type,
      priority: input.priority.trim() || "P3",
      description: input.description.trim() || null,
      quickbooks_no: input.quickbooks_no.trim() || null,
    })
    .eq("id", jobId);
  if (error) return { ok: false, message: error.message };

  // Best-effort, same non-blocking contract as every other Calendar sync
  // call in this file — a site change moves the job's location, so the
  // calendar event (if one exists) should reflect it too.
  after(() => syncCalendarForJob(supabase, jobId));

  revalidatePath(`/office/jobs/${jobId}`);
  revalidatePath("/office/jobs");
  revalidatePath("/office/scheduler");
  revalidatePath("/office/dashboard");
  return { ok: true, message: "Saved." };
}

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
  // in ../actions.ts for why a real Calendar API round trip (or an email
  // send) shouldn't sit between a manager clicking "Cancel" and seeing it
  // take effect.
  after(() => removeCalendarForJob(supabase, jobId));
  after(() => sendJobCancelledEmail(supabase, jobId, reason.trim() || null));

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
 * for the field app's "Job Information" section, see 20260117000000_job_details.sql)
 * and points job_details' matching *_storage_path column at it. Reuses the
 * existing 'media' bucket / jobs/{job_id}/{filename} path convention (see
 * media-capture.ts) rather than a new bucket — same storage policies apply.
 */
const DOCUMENT_LABELS = {
  rams: "RAMS",
  site_plan: "Site plan",
  design_pack: "Design pack",
  parking_permit: "Parking permit",
} as const;
const DOCUMENT_PATCH_KEYS = {
  rams: "rams_storage_path",
  site_plan: "site_plan_storage_path",
  design_pack: "design_pack_storage_path",
  parking_permit: "parking_permit_storage_path",
} as const;

export async function uploadJobDocument(
  jobId: string,
  kind: "rams" | "site_plan" | "design_pack" | "parking_permit",
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

  const patch = { [DOCUMENT_PATCH_KEYS[kind]]: storagePath };
  const { error } = await supabase.from("job_details").upsert({ job_id: jobId, ...patch }, { onConflict: "job_id" });
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/office/jobs/${jobId}`);
  return { ok: true, message: `${DOCUMENT_LABELS[kind]} uploaded.` };
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

/** Free-text job notes the office adds while preparing the job — shown read-only to the engineer in the field app's Job Information panel. */
export async function updateJobInformation(jobId: string, detail: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("job_details")
    .upsert({ job_id: jobId, job_information: detail.trim() || null }, { onConflict: "job_id" });
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/office/jobs/${jobId}`);
  return { ok: true, message: "Saved." };
}

/**
 * Parking restrictions/considerations and the known site manager contact —
 * set here at job creation/prep time so the engineer already has them
 * before travelling, on top of the same fields the engineer can also fill
 * in themselves on site (job-workflow.tsx) if the office didn't know them
 * up front. Same upsert-into-job_details shape as the two actions above.
 */
export async function updateParkingNotes(jobId: string, notes: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("job_details")
    .upsert({ job_id: jobId, parking_notes: notes.trim() || null }, { onConflict: "job_id" });
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/office/jobs/${jobId}`);
  return { ok: true, message: "Saved." };
}

export async function updateSiteManagerContact(jobId: string, name: string, phone: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("job_details")
    .upsert(
      { job_id: jobId, site_manager_name: name.trim() || null, site_manager_phone: phone.trim() || null },
      { onConflict: "job_id" },
    );
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

/**
 * Toggles whether one job_details field is required for this specific job
 * (see job_optional_fields — 20260122000000_job_optional_fields.sql).
 * `required: true` deletes any override row (back to the default); `false`
 * inserts one. RLS already restricts writes on that table to
 * manager/superadmin, so there's no role check duplicated here — same as
 * every other action in this file.
 */
export async function setJobFieldRequired(jobId: string, fieldKey: RequirableFieldKey, required: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = required
    ? await supabase.from("job_optional_fields").delete().eq("job_id", jobId).eq("field_key", fieldKey)
    : await supabase.from("job_optional_fields").insert({ job_id: jobId, field_key: fieldKey });
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/office/jobs/${jobId}`);
  return { ok: true, message: required ? "Marked required." : "Marked optional." };
}

export type AssignScheduleResult = { ok: true; message: string; warning?: string } | { ok: false; message: string };

/**
 * Single-job assign + schedule from the job detail page itself — the same
 * two operations the Scheduler tab's drag-and-drop does (see
 * rescheduleJob/bulkAssignJobs/bulkScheduleJobs in ../actions.ts), just
 * reachable without leaving the job. `scheduledStartLocal`/`scheduledEndLocal`
 * are UTC instants (ISO, "Z"-suffixed) already converted client-side from
 * the datetime-local inputs via localInputValueToIso — never pass the raw
 * datetime-local string here, since parsing it in this server action would
 * use the server's timezone instead of the office's (see
 * lib/format/datetime-local.ts). "" for start clears/leaves the schedule
 * alone, engineerId null unassigns, so the office user isn't forced to
 * touch both fields at once. `scheduledEndLocal` can be on a later
 * calendar date than the start — some jobs run across several on-site
 * days — so this deliberately takes an explicit end instant rather than a
 * same-day duration. `isProvisional` marks the job as unconfirmed (own
 * scheduler/map colour, "PROVISIONAL —" calendar title, blocked from
 * starting in the field app) while still sending the assignment
 * email/calendar event immediately — see PRE_WORK_STATUSES below.
 */
export async function assignAndScheduleJob(
  jobId: string,
  engineerId: string | null,
  scheduledStartLocal: string,
  scheduledEndLocal: string,
  isProvisional: boolean,
): Promise<AssignScheduleResult> {
  const supabase = await createClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("status, assigned_to, scheduled_end, site_id")
    .eq("id", jobId)
    .single();
  if (!job) return { ok: false, message: "Job not found." };

  const patch: { assigned_to: string | null; scheduled_start?: string; scheduled_end?: string } = {
    assigned_to: engineerId,
  };
  let newStart: Date | null = null;
  if (scheduledStartLocal) {
    newStart = new Date(scheduledStartLocal);
    if (Number.isNaN(newStart.getTime())) return { ok: false, message: "Invalid start date/time." };

    // Falls back to a 2-hour slot when the end is left blank, matching the
    // old fixed-duration default — the end field only needs filling in for
    // a job that runs longer or across multiple days.
    const newEnd = scheduledEndLocal ? new Date(scheduledEndLocal) : new Date(newStart.getTime() + 2 * 60 * 60 * 1000);
    if (Number.isNaN(newEnd.getTime())) return { ok: false, message: "Invalid end date/time." };
    if (newEnd <= newStart) return { ok: false, message: "Scheduled end must be after the start." };

    patch.scheduled_start = newStart.toISOString();
    patch.scheduled_end = newEnd.toISOString();
  }

  let warning: string | undefined;
  if (engineerId && newStart) {
    const dayStart = new Date(newStart);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const [{ data: engineer }, { data: others }] = await Promise.all([
      supabase.from("users").select("max_jobs_per_day").eq("id", engineerId).single(),
      supabase
        .from("jobs")
        .select("id, scheduled_start, scheduled_end")
        .eq("assigned_to", engineerId)
        .neq("id", jobId)
        .gte("scheduled_start", dayStart.toISOString())
        .lt("scheduled_start", dayEnd.toISOString()),
    ]);

    const warnings = detectConflicts(
      { id: jobId, scheduledStart: newStart.toISOString(), scheduledEnd: patch.scheduled_end! },
      (others ?? [])
        .filter((o) => o.scheduled_start)
        .map((o) => ({ id: o.id, scheduledStart: o.scheduled_start!, scheduledEnd: o.scheduled_end })),
      engineer?.max_jobs_per_day ?? 4,
    );
    if (warnings.length > 0) warning = warnings.join(" ");
  }

  const { error } = await supabase.from("jobs").update(patch).eq("id", jobId);
  if (error) return { ok: false, message: error.message };

  const user = await getCurrentUser();
  // "draft" and "provisional" are both pre-work states this action can move
  // a job out of once a start date is set: to "provisional" if the
  // checkbox is on, otherwise straight to "scheduled" (this also lets the
  // office confirm a provisional job by re-saving with the checkbox off).
  // A no-op when the target matches the current status, so re-saving a
  // provisional job's time without touching the checkbox doesn't log a
  // spurious status_events row.
  const PRE_WORK_STATUSES = new Set(["draft", "provisional"]);
  if (PRE_WORK_STATUSES.has(job.status) && newStart) {
    const targetStatus = isProvisional ? "provisional" : "scheduled";
    if (targetStatus !== job.status) {
      await supabase.from("jobs").update({ status: targetStatus }).eq("id", jobId);
      await supabase.from("status_events").insert({
        job_id: jobId,
        from_status: job.status,
        to_status: targetStatus,
        user_id: user?.id,
        reason: "Scheduled from job detail",
      });
    }
  }

  // Same best-effort, non-blocking contract as rescheduleJob/bulkAssignJobs
  // in ../actions.ts — a Calendar/Resend round trip shouldn't sit between
  // the office user clicking Save and seeing it take effect. A schedule
  // being set here (newStart) always sends "New Job Scheduled" to whoever
  // ends up assigned — reassignment alone (no schedule touched) still gets
  // the lighter "assigned" email instead.
  const effectiveEngineerId = engineerId ?? job.assigned_to;
  after(async () => {
    await syncCalendarForJob(supabase, jobId);
    try {
      if (newStart && effectiveEngineerId) {
        await sendJobScheduledEmail(supabase, jobId);
      } else if (engineerId && engineerId !== job.assigned_to) {
        await sendJobAssignedEmail(supabase, jobId);
      }
    } catch (error) {
      // Unlike syncCalendarForJob (which self-catches), sendJobEmail throws
      // on a real Resend failure — inside after() that becomes an
      // unhandled rejection with no clear record of which job/email it
      // was, which is exactly what made a real "no emails sending" report
      // indistinguishable from "nothing happened." Log it here instead.
      console.error(`Scheduled/assigned email failed for job ${jobId}`, error);
    }
  });

  revalidatePath(`/office/jobs/${jobId}`);
  revalidatePath("/office/jobs");
  revalidatePath("/office/scheduler");
  return { ok: true, message: "Saved.", warning };
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
