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
        "id, job_number, scheduled_start, scheduled_end, calendar_event_id, description, site:sites(name, address_line1, address_line2, town, postcode, access_notes, contact_name, contact_phone, latitude, longitude)",
      )
      .eq("id", jobId)
      .single();
    if (!job || !job.site || !job.scheduled_start || !job.scheduled_end) return;

    const result = await syncJobCalendarEvent(job, job.site, appBaseUrl());
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
