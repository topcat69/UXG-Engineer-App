"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { syncCalendarForJob } from "@/lib/google/sync-job-calendar";
import { sendJobAssignedEmail } from "@/lib/email/send-job-emails";
import { nextJobNumber } from "@/lib/jobs/job-number";
import { maxJobSequenceForYear } from "@/lib/jobs/next-job-number";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

export type CreateJobResult = { ok: true; jobId: string } | { ok: false; message: string };

/**
 * Single-job counterpart to the CSV importer's bulk generateJobs (see
 * office/import/actions.ts) — same job_number scheme, same draft starting
 * status, just one row instead of many. The job only needs project_id and
 * site_id: a job's client is always derivable via site_id -> sites.client_id
 * rather than stored redundantly on the job itself (see
 * 20260116000000_clients.sql).
 */
export async function createJob(projectId: string, siteId: string, jobType: string): Promise<CreateJobResult> {
  if (!projectId) return { ok: false, message: "Select a project." };
  if (!siteId) return { ok: false, message: "Select a site." };
  if (!jobType) return { ok: false, message: "Select a job type." };

  const supabase = await createClient();
  const year = new Date().getFullYear();
  const maxSeq = await maxJobSequenceForYear(supabase, year);

  const { data, error } = await supabase
    .from("jobs")
    .insert({
      job_number: nextJobNumber(maxSeq, year, 1),
      project_id: projectId,
      site_id: siteId,
      job_type: jobType,
      status: "draft",
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/jobs");
  return { ok: true, jobId: data.id };
}

export async function bulkAssignJobs(jobIds: string[], engineerId: string): Promise<ActionResult> {
  if (jobIds.length === 0) return { ok: false, message: "No jobs selected." };

  const supabase = await createClient();
  const { error } = await supabase.from("jobs").update({ assigned_to: engineerId }).in("id", jobIds);
  if (error) return { ok: false, message: error.message };

  // Best-effort, per sendJobAssignedEmail's own contract — a Resend/config
  // failure never blocks the assignment itself from succeeding. Scheduled
  // via after() rather than awaited: emails are inherently network calls to
  // a third party, and awaiting N of them here would make the response the
  // office user sees scale with Resend's latency times N jobs, not just the
  // (already-succeeded) database write above — the same "best-effort, never
  // blocking" contract this comment already claimed, but actually kept.
  after(() => Promise.all(jobIds.map((id) => sendJobAssignedEmail(supabase, id))));

  revalidatePath("/office/jobs");
  return { ok: true, message: `Assigned ${jobIds.length} job(s).` };
}

export async function bulkScheduleJobs(
  jobIds: string[],
  scheduledStart: string,
  durationHours: number,
): Promise<ActionResult> {
  if (jobIds.length === 0) return { ok: false, message: "No jobs selected." };

  const start = new Date(scheduledStart);
  if (Number.isNaN(start.getTime())) return { ok: false, message: "Invalid start date/time." };
  const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);

  const supabase = await createClient();

  // Draft jobs move into the schedule; anything further along the lifecycle
  // keeps its current status — rescheduling shouldn't undo progress already made.
  const { data: draftJobs } = await supabase.from("jobs").select("id").in("id", jobIds).eq("status", "draft");
  const draftIds = (draftJobs ?? []).map((j) => j.id);

  const { error } = await supabase
    .from("jobs")
    .update({ scheduled_start: start.toISOString(), scheduled_end: end.toISOString() })
    .in("id", jobIds);
  if (error) return { ok: false, message: error.message };

  if (draftIds.length > 0) {
    const { error: statusError } = await supabase.from("jobs").update({ status: "scheduled" }).in("id", draftIds);
    if (statusError) return { ok: false, message: statusError.message };

    // Status changes are append-only per the non-negotiable audit-trail rule —
    // never just overwrite the field without a status_events row.
    const user = await getCurrentUser();
    const { error: eventsError } = await supabase.from("status_events").insert(
      draftIds.map((id) => ({
        job_id: id,
        from_status: "draft" as const,
        to_status: "scheduled" as const,
        user_id: user?.id,
        reason: "Bulk scheduled",
      })),
    );
    if (eventsError) return { ok: false, message: eventsError.message };
  }

  // Calendar sync is per-job (each gets its own event) and best-effort —
  // see syncCalendarForJob's own contract for why a Calendar failure never
  // surfaces as a scheduling failure. Scheduled via after(), not awaited,
  // for the same reason as bulkAssignJobs's email send above: a real bulk
  // schedule of hundreds of jobs (PROMPT.md's own stated scale) would
  // otherwise make the office user's browser wait on hundreds of real
  // Calendar API round trips before seeing "Scheduled." — confirmed for
  // real once live credentials were wired in (see DECISIONS.md), not a
  // theoretical concern.
  after(() => Promise.all(jobIds.map((id) => syncCalendarForJob(supabase, id))));

  revalidatePath("/office/jobs");
  return { ok: true, message: `Scheduled ${jobIds.length} job(s).` };
}
