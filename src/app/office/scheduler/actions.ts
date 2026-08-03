"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { detectConflicts } from "@/lib/scheduler/conflicts";

export type RescheduleResult = { ok: true; message: string; warning?: string } | { ok: false; message: string };

/**
 * Moves a job to `targetDateIso` (YYYY-MM-DD), keeping its original
 * time-of-day and duration, and reassigns it to `targetEngineerId` (or
 * unassigns if null) — a single drag-and-drop covers both axes of the board.
 */
export async function rescheduleJob(
  jobId: string,
  targetDateIso: string,
  targetEngineerId: string | null,
): Promise<RescheduleResult> {
  const supabase = await createClient();

  const { data: job } = await supabase
    .from("jobs")
    .select("scheduled_start, scheduled_end, status")
    .eq("id", jobId)
    .single();
  if (!job || !job.scheduled_start) return { ok: false, message: "Job not found or has no schedule yet." };

  const oldStart = new Date(job.scheduled_start);
  const [year, month, day] = targetDateIso.split("-").map(Number);
  const newStart = new Date(oldStart);
  newStart.setFullYear(year, month - 1, day);

  const durationMs = job.scheduled_end
    ? new Date(job.scheduled_end).getTime() - oldStart.getTime()
    : 2 * 60 * 60 * 1000;
  const newEnd = new Date(newStart.getTime() + durationMs);

  let warning: string | undefined;

  if (targetEngineerId) {
    const dayStart = new Date(newStart);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const [{ data: engineer }, { data: others }] = await Promise.all([
      supabase.from("users").select("max_jobs_per_day").eq("id", targetEngineerId).single(),
      supabase
        .from("jobs")
        .select("id, scheduled_start, scheduled_end")
        .eq("assigned_to", targetEngineerId)
        .neq("id", jobId)
        .gte("scheduled_start", dayStart.toISOString())
        .lt("scheduled_start", dayEnd.toISOString()),
    ]);

    const warnings = detectConflicts(
      { id: jobId, scheduledStart: newStart.toISOString(), scheduledEnd: newEnd.toISOString() },
      (others ?? [])
        .filter((o) => o.scheduled_start)
        .map((o) => ({ id: o.id, scheduledStart: o.scheduled_start!, scheduledEnd: o.scheduled_end })),
      engineer?.max_jobs_per_day ?? 4,
    );
    if (warnings.length > 0) warning = warnings.join(" ");
  }

  const { error } = await supabase
    .from("jobs")
    .update({
      scheduled_start: newStart.toISOString(),
      scheduled_end: newEnd.toISOString(),
      assigned_to: targetEngineerId,
    })
    .eq("id", jobId);
  if (error) return { ok: false, message: error.message };

  const user = await getCurrentUser();
  if (job.status === "draft") {
    await supabase.from("jobs").update({ status: "scheduled" }).eq("id", jobId);
    await supabase.from("status_events").insert({
      job_id: jobId,
      from_status: "draft",
      to_status: "scheduled",
      user_id: user?.id,
      reason: "Scheduled via drag-and-drop",
    });
  }

  revalidatePath("/office/scheduler");
  revalidatePath("/office/jobs");
  return { ok: true, message: warning ? `Moved. ${warning}` : "Moved.", warning };
}
