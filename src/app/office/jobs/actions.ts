"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { syncCalendarForJob } from "@/lib/google/sync-job-calendar";
import { sendJobAssignedEmail } from "@/lib/email/send-job-emails";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

export async function bulkAssignJobs(jobIds: string[], engineerId: string): Promise<ActionResult> {
  if (jobIds.length === 0) return { ok: false, message: "No jobs selected." };

  const supabase = await createClient();
  const { error } = await supabase.from("jobs").update({ assigned_to: engineerId }).in("id", jobIds);
  if (error) return { ok: false, message: error.message };

  // Best-effort, per sendJobAssignedEmail's own contract — a Resend/config
  // failure never blocks the assignment itself from succeeding.
  await Promise.all(jobIds.map((id) => sendJobAssignedEmail(supabase, id)));

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
  // surfaces as a scheduling failure.
  await Promise.all(jobIds.map((id) => syncCalendarForJob(supabase, id)));

  revalidatePath("/office/jobs");
  return { ok: true, message: `Scheduled ${jobIds.length} job(s).` };
}
