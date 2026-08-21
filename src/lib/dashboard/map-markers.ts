// Pure transform from raw job rows into map marker shape — no Supabase
// calls, no Leaflet, so it's independently testable, same convention as
// metrics.ts.

export type MapCategory = "scheduled" | "on_site" | "revisit";

/** Engineer is currently there or travelling to it right now — the map's "happening now" color. */
const ON_SITE_STATUSES = new Set(["travelling", "on_site", "in_progress"]);

/** Everything the dashboard map plots — anything not scheduled or actively being worked stays off the map entirely (no dot at all, not just a dulled one): closed/cancelled/etc. jobs aren't "where the work is happening" any more. */
const VISIBLE_STATUSES = new Set(["scheduled", ...ON_SITE_STATUSES]);

export function categorizeJobStatus(status: string): "scheduled" | "on_site" {
  return ON_SITE_STATUSES.has(status) ? "on_site" : "scheduled";
}

/**
 * A revisit (parent_job_id set — raised from a QA rejection or a
 * blocks_completion issue) gets its own map color that takes priority over
 * the plain scheduled/on_site split: knowing "this is a redo" at a glance
 * matters more on the map than which stage it's at, and it stays its own
 * status the whole way through (scheduled/travelling/etc.) rather than a
 * distinct status value, per parent_job_id already being the source of
 * truth for "is this a revisit" elsewhere (dashboard revisit-rate metric,
 * jobs list ?is_revisit= drill-through).
 */
export function categorizeJob(status: string, isRevisit: boolean): MapCategory {
  return isRevisit ? "revisit" : categorizeJobStatus(status);
}

export type RawMapJob = {
  id: string;
  job_number: string;
  status: string;
  parent_job_id: string | null;
  project_id: string | null;
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
      category: categorizeJob(j.status, j.parent_job_id != null),
    }));
}
