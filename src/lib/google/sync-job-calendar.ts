import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { appBaseUrl } from "@/lib/app-url";
import { deleteJobCalendarEvent, syncJobCalendarEvent } from "./calendar";

type AnySupabaseClient = SupabaseClient<Database>;

/**
 * Fetches the job + site, creates or patches its calendar event (per
 * `calendar_event_id`), and persists whatever id Google returns — the one
 * place every schedule/reschedule call site goes through, so "if
 * calendar_event_id is null create, else patch" only has to be right once.
 * Best-effort: a Calendar failure (including "not configured" in this
 * sandbox) never throws back into the caller, since scheduling a job must
 * succeed regardless of whether the calendar integration is reachable.
 */
export async function syncCalendarForJob(supabase: AnySupabaseClient, jobId: string): Promise<void> {
  try {
    const { data: job } = await supabase
      .from("jobs")
      .select(
        "id, job_number, scheduled_start, scheduled_end, calendar_event_id, description, job_type, priority, assigned:users!jobs_assigned_to_fkey(name), job_details(job_information, sla_requirement_detail), job_equipment(model, serial), site:sites(name, address_line1, address_line2, town, postcode, access_notes, contact_name, contact_phone, latitude, longitude)",
      )
      .eq("id", jobId)
      .single();
    if (!job || !job.site || !job.scheduled_start || !job.scheduled_end) return;

    const calendarJob = {
      id: job.id,
      job_number: job.job_number,
      scheduled_start: job.scheduled_start,
      scheduled_end: job.scheduled_end,
      calendar_event_id: job.calendar_event_id,
      description: job.description,
      job_type: job.job_type,
      priority: job.priority,
      assignedName: job.assigned?.name ?? null,
      jobInformation: job.job_details?.job_information ?? null,
      slaRequirementDetail: job.job_details?.sla_requirement_detail ?? null,
      equipment: job.job_equipment ?? [],
    };

    const result = await syncJobCalendarEvent(calendarJob, job.site, appBaseUrl());
    if (result.status !== "skipped" && result.eventId !== job.calendar_event_id) {
      await supabase.from("jobs").update({ calendar_event_id: result.eventId }).eq("id", jobId);
    }
  } catch (error) {
    console.error(`Calendar sync failed for job ${jobId}`, error);
  }
}

/** On cancel: delete the event and null the id, per spec — same best-effort contract as above. */
export async function removeCalendarForJob(supabase: AnySupabaseClient, jobId: string): Promise<void> {
  try {
    const { data: job } = await supabase.from("jobs").select("calendar_event_id").eq("id", jobId).single();
    if (!job?.calendar_event_id) return;

    await deleteJobCalendarEvent(job.calendar_event_id);
    await supabase.from("jobs").update({ calendar_event_id: null }).eq("id", jobId);
  } catch (error) {
    console.error(`Calendar removal failed for job ${jobId}`, error);
  }
}
