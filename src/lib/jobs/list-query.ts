import type { Database } from "@/lib/supabase/database.types";
import { ACTIVE_STATUSES } from "@/lib/dashboard/metrics";

export type JobListSearchParams = Record<string, string | string[] | undefined>;

function param(searchParams: JobListSearchParams, key: string): string {
  const value = searchParams[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export type JobListFilters = {
  status: string;
  jobType: string;
  projectId: string;
  assignedTo: string;
  clientId: string;
  siteId: string;
  q: string;
  /** Dashboard drill-through: an exact set of job ids, computed client-side from data the dashboard already has in memory (see metrics.ts) — the only way to filter precisely on things like "which jobs a specific revisit-cause category produced" without a bespoke join query per chart. */
  ids: string[];
  /** Dashboard drill-through for "scheduled" — same ACTIVE_STATUSES set computeCompletedVsScheduled/computeEngineerWorkload use, so the count and the drill-through never disagree. */
  active: boolean;
  /** Dashboard drill-through for revisit jobs (parent_job_id is not null). */
  isRevisit: boolean;
};

/** Pure parsing — the actual Supabase query building (applyJobListFilters) isn't, so this is the part worth unit testing directly. */
export function parseJobListFilters(searchParams: JobListSearchParams): JobListFilters {
  const idsParam = param(searchParams, "ids");
  return {
    status: param(searchParams, "status"),
    jobType: param(searchParams, "job_type"),
    projectId: param(searchParams, "project_id"),
    assignedTo: param(searchParams, "assigned_to"),
    clientId: param(searchParams, "client_id"),
    siteId: param(searchParams, "site_id"),
    q: param(searchParams, "q"),
    ids: idsParam ? idsParam.split(",").filter(Boolean) : [],
    active: param(searchParams, "active") === "true",
    isRevisit: param(searchParams, "is_revisit") === "true",
  };
}

export function hasAnyFilter(filters: JobListFilters): boolean {
  return !!(
    filters.status ||
    filters.jobType ||
    filters.projectId ||
    filters.assignedTo ||
    filters.clientId ||
    filters.siteId ||
    filters.q ||
    filters.ids.length > 0 ||
    filters.active ||
    filters.isRevisit
  );
}

// Loose typing here (not the full PostgrestFilterBuilder generic chain) —
// this function is called with both the paginated list query and the
// unpaginated CSV export query, which end up with different generic
// instantiations after `.select()`; the return type callers actually use
// is whatever they passed in, narrowed by TypeScript's control flow at the
// call site, not by this function's signature.
//
// filters.clientId is deliberately NOT applied here: jobs has no client_id
// column (only site_id, and a site belongs to a client), so filtering by
// client means resolving that client's site ids first — a real query this
// function can't run, being a synchronous chain-builder. Callers that want
// it resolve those site ids themselves and fold them into filters.siteId
// (or a client-side `.in("site_id", ...)`) before/after calling this.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyJobListFilters<T extends { eq: any; is: any; ilike: any; in: any; not: any }>(
  query: T,
  filters: JobListFilters,
): T {
  let q = query;
  if (filters.status) q = q.eq("status", filters.status as Database["public"]["Enums"]["job_status"]);
  if (filters.jobType) q = q.eq("job_type", filters.jobType);
  if (filters.projectId) q = q.eq("project_id", filters.projectId);
  if (filters.siteId) q = q.eq("site_id", filters.siteId);
  if (filters.assignedTo === "unassigned") q = q.is("assigned_to", null);
  else if (filters.assignedTo) q = q.eq("assigned_to", filters.assignedTo);
  if (filters.q) q = q.ilike("job_number", `%${filters.q}%`);
  if (filters.ids.length > 0) q = q.in("id", filters.ids);
  if (filters.active) q = q.in("status", Array.from(ACTIVE_STATUSES));
  if (filters.isRevisit) q = q.not("parent_job_id", "is", null);
  return q;
}
