import "server-only";
import { google } from "googleapis";
import type { CalendarJob, CalendarSite } from "./event-payload";
import { syncEvent, deleteEvent, type CalendarClientLike, type SyncResult } from "./sync-logic";

export type { CalendarJob, CalendarSite, SyncResult };
export { buildEventPayload, fullSiteAddress } from "./event-payload";

/**
 * One-way, OPOC → Calendar only — this client is never used to read or
 * accept edits back, only free/busy (for conflict warnings, built
 * separately) and create/patch/delete of events this app itself owns.
 * Domain-wide delegation: the service account impersonates
 * GOOGLE_CALENDAR_IMPERSONATE_EMAIL, which must be an in-domain user with
 * that service account's client ID authorized for the calendar scope in
 * the Workspace admin console. Returns null (not a thrown error) when
 * unconfigured, so callers can treat Calendar sync as a best-effort,
 * non-blocking side effect of scheduling — exactly as it should behave in
 * production too, where a misconfigured integration shouldn't stop an
 * engineer being scheduled.
 */
export function getCalendarClient(): CalendarClientLike | null {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const impersonate = process.env.GOOGLE_CALENDAR_IMPERSONATE_EMAIL;
  if (!keyJson || !impersonate) return null;

  const key = JSON.parse(keyJson) as { client_email: string; private_key: string };
  const auth = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ["https://www.googleapis.com/auth/calendar"],
    subject: impersonate,
  });
  // googleapis's generated Calendar type has overloaded call signatures
  // (callback vs promise, streaming vs not) that don't structurally match
  // the narrow single-call shape sync-logic.ts actually uses — the runtime
  // behavior is compatible (we only ever call the promise form), so this
  // cast is just narrowing the type, not changing what's called.
  return google.calendar({ version: "v3", auth }) as unknown as CalendarClientLike;
}

function calendarId(): string {
  return process.env.GOOGLE_CALENDAR_ID || "primary";
}

export async function syncJobCalendarEvent(job: CalendarJob, site: CalendarSite, deepLinkBaseUrl: string): Promise<SyncResult> {
  return syncEvent(getCalendarClient(), job, site, deepLinkBaseUrl, calendarId());
}

export async function deleteJobCalendarEvent(calendarEventId: string): Promise<SyncResult> {
  return deleteEvent(getCalendarClient(), calendarEventId, calendarId());
}
