import type { Database } from "@/lib/supabase/database.types";

type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
type SiteRow = Database["public"]["Tables"]["sites"]["Row"];

export type CalendarJob = Pick<
  JobRow,
  "id" | "job_number" | "scheduled_start" | "scheduled_end" | "calendar_event_id" | "description"
>;
export type CalendarSite = Pick<
  SiteRow,
  | "name"
  | "address_line1"
  | "address_line2"
  | "town"
  | "postcode"
  | "access_notes"
  | "contact_name"
  | "contact_phone"
  | "latitude"
  | "longitude"
>;

/** Full postal address as one line — this is what goes in the event's `location`
 * field so the calendar entry is tap-to-navigate in Google Maps, per spec. */
export function fullSiteAddress(site: CalendarSite): string {
  return [site.address_line1, site.address_line2, site.town, site.postcode].filter(Boolean).join(", ");
}

/** Direct link to the site's exact stored coordinates, when we have them —
 * more precise than relying on the calendar app's own geocoding of the
 * `location` string, which can miss new-builds, rural sites, or multi-unit
 * buildings. */
function coordinatesMapLink(site: CalendarSite): string | null {
  if (site.latitude == null || site.longitude == null) return null;
  return `https://www.google.com/maps?q=${site.latitude},${site.longitude}`;
}

export type EventPayload = {
  summary: string;
  location: string;
  description: string;
  start: { date: string };
  end: { date: string };
};

/**
 * The calendar's day *after* the last day the job runs — Google Calendar's
 * all-day events use an exclusive end date (a single-day event on the 20th
 * has start "2026-08-20"/end "2026-08-21"), so a job scheduled through the
 * 22nd needs end "2026-08-23", not "2026-08-22". Manipulated as a UTC date
 * string rather than a local Date, matching how the rest of this app slices
 * day boundaries off ISO timestamps directly (see scheduler/week.ts).
 */
function exclusiveEndDate(scheduledEndIso: string): string {
  const d = new Date(`${scheduledEndIso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Pure event-body builder — no network, fully unit-testable. Title and
 * location follow the spec exactly: `{job_number} — {site.name}` and the
 * full postal address (not just the site name) so the event is
 * tap-to-navigate. `deepLinkBaseUrl` lets callers point the description's
 * job link at whatever origin the app is actually deployed on.
 *
 * All-day rather than timed: office staff scanning a calendar care about
 * which day(s) an engineer is on site, not the exact hour — a timed event
 * with the job's often-approximate scheduled_start/end was reading as more
 * precise than it actually is. Multi-day jobs (scheduled_end on a later
 * calendar date than scheduled_start) become a single all-day event
 * spanning that whole range, via `exclusiveEndDate`.
 */
export function buildEventPayload(job: CalendarJob, site: CalendarSite, deepLinkBaseUrl: string): EventPayload {
  if (!job.scheduled_start || !job.scheduled_end) {
    throw new Error(`Job ${job.id} has no schedule — cannot build a calendar event`);
  }

  const descriptionLines = [
    `Site: ${site.name}`,
    job.description ? `Job description: ${job.description}` : null,
    site.access_notes ? `Access notes: ${site.access_notes}` : null,
    site.contact_name ? `Site contact: ${site.contact_name}${site.contact_phone ? ` (${site.contact_phone})` : ""}` : null,
    coordinatesMapLink(site),
    `${deepLinkBaseUrl}/office/jobs/${job.id}`,
  ].filter((line): line is string => !!line);

  return {
    summary: `${job.job_number} — ${site.name}`,
    location: fullSiteAddress(site),
    description: descriptionLines.join("\n"),
    start: { date: job.scheduled_start.slice(0, 10) },
    end: { date: exclusiveEndDate(job.scheduled_end) },
  };
}
