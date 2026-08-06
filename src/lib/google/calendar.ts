import "server-only";
import { google } from "googleapis";
import type { CalendarJob, CalendarSite } from "./event-payload";
import { syncEvent, deleteEvent, type CalendarClientLike, type SyncResult } from "./sync-logic";

export type { CalendarJob, CalendarSite, SyncResult };
export { buildEventPayload, fullSiteAddress } from "./event-payload";

/**
 * One-way, this app → Calendar only — this client is never used to read or
 * accept edits back, only free/busy (for conflict warnings, built
 * separately) and create/patch/delete of events this app itself owns.
 * Two supported auth modes, both via the same GOOGLE_SERVICE_ACCOUNT_KEY:
 * - Domain-wide delegation (GOOGLE_CALENDAR_IMPERSONATE_EMAIL set): the
 *   service account impersonates that in-domain user, who must have this
 *   service account's client ID authorized for the calendar scope in the
 *   Workspace admin console. This is the intended production mode — events
 *   land on a real office calendar humans actually look at.
 * - Direct (GOOGLE_CALENDAR_IMPERSONATE_EMAIL unset): the service account
 *   authenticates as itself, against its own "primary" calendar (or
 *   whichever GOOGLE_CALENDAR_ID a human has explicitly shared with the
 *   service account's client_email as an editor). No Workspace admin
 *   console access needed — useful for a personal/no-Workspace Google
 *   Cloud project, or for verifying the integration end-to-end before
 *   domain-wide delegation is set up.
 * Returns null (not a thrown error) only when GOOGLE_SERVICE_ACCOUNT_KEY
 * itself is unconfigured, so callers can treat Calendar sync as a
 * best-effort, non-blocking side effect of scheduling — exactly as it
 * should behave in production too, where a misconfigured integration
 * shouldn't stop an engineer being scheduled.
 */
export function getCalendarClient(): CalendarClientLike | null {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) return null;
  const impersonate = process.env.GOOGLE_CALENDAR_IMPERSONATE_EMAIL;

  const key = JSON.parse(keyJson) as { client_email: string; private_key: string };
  const auth = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ["https://www.googleapis.com/auth/calendar"],
    subject: impersonate || undefined,
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
