// Pure transform from raw job rows into map marker shape — no Supabase
// calls, no Leaflet, so it's independently testable, same convention as
// metrics.ts.

export type MapCategory = "scheduled" | "on_site";

/** Engineer is currently there or travelling to it right now — the map's "happening now" color. */
const ON_SITE_STATUSES = new Set(["travelling", "on_site", "in_progress"]);

/** Everything the dashboard map plots — anything not scheduled or actively being worked stays off the map entirely (no dot at all, not just a dulled one): closed/cancelled/etc. jobs aren't "where the work is happening" any more. */
const VISIBLE_STATUSES = new Set(["scheduled", ...ON_SITE_STATUSES]);

export function categorizeJobStatus(status: string): MapCategory {
  return ON_SITE_STATUSES.has(status) ? "on_site" : "scheduled";
}

export type RawMapJob = {
  id: string;
  job_number: string;
  status: string;
  site: { name: string; latitude: number | null; longitude: number | null } | null;
  assigned: { name: string } | null;
};

export type JobMapMarker = {
  id: string;
  jobNumber: string;
  siteName: string;
  status: string;
  assignedName: string | null;
  latitude: number;
  longitude: number;
  category: MapCategory;
};

/**
 * Drops jobs whose site has no coordinates on file — nothing to plot for
 * those, and this app has no live-geocoding-on-render step (see the
 * postcode-fallback addendum for why: geocoding is a fallback for engineer
 * GPS, not something the dashboard does for every site on every render).
 * Also drops any job not in VISIBLE_STATUSES — the map is scoped to
 * "where is the work happening/about to happen", not a full history.
 */
export function buildJobMapMarkers(jobs: RawMapJob[]): JobMapMarker[] {
  return jobs
    .filter((j) => j.site?.latitude != null && j.site?.longitude != null)
    .filter((j) => VISIBLE_STATUSES.has(j.status))
    .map((j) => ({
      id: j.id,
      jobNumber: j.job_number,
      siteName: j.site!.name,
      status: j.status,
      assignedName: j.assigned?.name ?? null,
      latitude: j.site!.latitude!,
      longitude: j.site!.longitude!,
      category: categorizeJobStatus(j.status),
    }));
}
