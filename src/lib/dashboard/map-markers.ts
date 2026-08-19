// Pure transform from raw job rows into map marker shape — no Supabase
// calls, no Leaflet, so it's independently testable, same convention as
// metrics.ts.

export type MapCategory = "on_site" | "completed" | "other";

/** Engineer is currently there or travelling to it right now — the map's "happening now" color. */
const ON_SITE_STATUSES = new Set(["travelling", "on_site", "in_progress"]);
/** Reached QA approval or closed — distinct from ACTIVE_STATUSES in metrics.ts, which groups "not yet finished" for the workload chart; this is specifically about map at-a-glance coloring. */
const COMPLETED_STATUSES = new Set(["approved", "closed"]);

export function categorizeJobStatus(status: string): MapCategory {
  if (ON_SITE_STATUSES.has(status)) return "on_site";
  if (COMPLETED_STATUSES.has(status)) return "completed";
  return "other";
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

/** Drops jobs whose site has no coordinates on file — nothing to plot for those, and this app has no live-geocoding-on-render step (see the postcode-fallback addendum for why: geocoding is a fallback for engineer GPS, not something the dashboard does for every site on every render). */
export function buildJobMapMarkers(jobs: RawMapJob[]): JobMapMarker[] {
  return jobs
    .filter((j) => j.site?.latitude != null && j.site?.longitude != null)
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
