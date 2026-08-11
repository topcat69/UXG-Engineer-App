import type { Database } from "@/lib/supabase/database.types";

type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
type SiteRow = Database["public"]["Tables"]["sites"]["Row"];

export type CalendarJob = Pick<
  JobRow,
  "id" | "job_number" | "scheduled_start" | "scheduled_end" | "calendar_event_id"
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
  start: { dateTime: string };
  end: { dateTime: string };
};

/**
 * Pure event-body builder — no network, fully unit-testable. Title and
 * location follow the spec exactly: `{job_number} — {site.name}` and the
 * full postal address (not just the site name) so the event is
 * tap-to-navigate. `deepLinkBaseUrl` lets callers point the description's
 * job link at whatever origin the app is actually deployed on.
 */
export function buildEventPayload(job: CalendarJob, site: CalendarSite, deepLinkBaseUrl: string): EventPayload {
  if (!job.scheduled_start || !job.scheduled_end) {
    throw new Error(`Job ${job.id} has no schedule — cannot build a calendar event`);
  }

  const descriptionLines = [
    site.access_notes ? `Access notes: ${site.access_notes}` : null,
    site.contact_name ? `Site contact: ${site.contact_name}${site.contact_phone ? ` (${site.contact_phone})` : ""}` : null,
    coordinatesMapLink(site),
    `${deepLinkBaseUrl}/office/jobs/${job.id}`,
  ].filter((line): line is string => !!line);

  return {
    summary: `${job.job_number} — ${site.name}`,
    location: fullSiteAddress(site),
    description: descriptionLines.join("\n"),
    start: { dateTime: job.scheduled_start },
    end: { dateTime: job.scheduled_end },
  };
}
