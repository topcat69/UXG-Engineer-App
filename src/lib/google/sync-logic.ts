import { buildEventPayload, type CalendarJob, type CalendarSite } from "./event-payload";

export type SyncResult = { status: "created" | "updated" | "deleted" | "skipped"; eventId: string | null };

/**
 * Just the shape of googleapis's calendar client this app actually calls —
 * kept separate from the real `googleapis` import so the create-vs-patch
 * logic below can be unit tested with a plain fake object instead of
 * mocking the SDK (or needing live credentials, which this sandbox has
 * neither of). calendar.ts's `server-only` guard means it can't be
 * imported into a test at all; this file is the part of that logic worth
 * testing in isolation.
 */
export type CalendarClientLike = {
  events: {
    insert(params: { calendarId: string; requestBody: unknown }): Promise<{ data: { id?: string | null } }>;
    patch(params: {
      calendarId: string;
      eventId: string;
      requestBody: unknown;
    }): Promise<{ data: { id?: string | null } }>;
    delete(params: { calendarId: string; eventId: string }): Promise<unknown>;
  };
};

/**
 * Create-vs-patch branch per spec: missing this is "the most common failure
 * of this integration" (duplicate events on every reschedule), so
 * `calendar_event_id` is the single source of truth for which branch to
 * take, not "did we already try this job before" or any other heuristic.
 */
export async function syncEvent(
  calendar: CalendarClientLike | null,
  job: CalendarJob,
  site: CalendarSite,
  deepLinkBaseUrl: string,
  calendarId: string,
): Promise<SyncResult> {
  if (!calendar) return { status: "skipped", eventId: job.calendar_event_id };

  const payload = buildEventPayload(job, site, deepLinkBaseUrl);

  if (job.calendar_event_id) {
    const { data } = await calendar.events.patch({
      calendarId,
      eventId: job.calendar_event_id,
      requestBody: payload,
    });
    return { status: "updated", eventId: data.id ?? job.calendar_event_id };
  }

  const { data } = await calendar.events.insert({ calendarId, requestBody: payload });
  return { status: "created", eventId: data.id ?? null };
}

/** On cancel: delete the event and null the id, per spec. */
export async function deleteEvent(calendar: CalendarClientLike | null, calendarEventId: string, calendarId: string): Promise<SyncResult> {
  if (!calendar) return { status: "skipped", eventId: calendarEventId };

  await calendar.events.delete({ calendarId, eventId: calendarEventId }).catch((error: unknown) => {
    // A 410/404 here means the event is already gone (e.g. deleted by hand
    // in Calendar) — that's the desired end state, not a failure to surface.
    const status = (error as { code?: number; response?: { status?: number } })?.response?.status;
    if (status !== 404 && status !== 410) throw error;
  });
  return { status: "deleted", eventId: null };
}
