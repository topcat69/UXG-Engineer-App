import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { computeWorkedMinutes, computeTravelMinutes, roundToNearest15Minutes } from "@/lib/jobs/worked-duration";
import { isoDate, mondayOf } from "@/lib/scheduler/week";
import { humanize } from "@/lib/format/text";

type AnySupabaseClient = SupabaseClient<Database>;
type JobStatus = Database["public"]["Enums"]["job_status"];

export const ALL_JOB_STATUSES: JobStatus[] = [
  "draft",
  "provisional",
  "scheduled",
  "dispatched",
  "accepted",
  "travelling",
  "on_site",
  "in_progress",
  "submitted",
  "under_review",
  "approved",
  "closed",
  "on_hold",
  "cancelled",
  "revisit",
];

export type GroupBy = "status" | "engineer" | "site";
export const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: "status", label: "Status" },
  { value: "engineer", label: "Engineer" },
  { value: "site", label: "Site" },
];

export type ProjectRollupFilters = {
  projectId: string;
  clientId: string;
  status: string;
  jobType: string;
  siteId: string;
  assignedTo: string;
  dateFrom: string;
  dateTo: string;
  groupBy: GroupBy;
};

export type ProjectRollupJobRow = {
  jobId: string;
  jobNumber: string;
  siteName: string;
  status: JobStatus;
  engineerName: string;
  scheduledStart: string | null;
};

export type GroupTimeEntry = { label: string; jobCount: number; workedMinutes: number; travelMinutes: number };

export type ProjectRollupReportData = {
  filters: ProjectRollupFilters;
  groupByLabel: string;
  jobCount: number;
  workedMinutesTotal: number;
  travelMinutesTotal: number;
  issueCount: number;
  statusCounts: { status: JobStatus; label: string; count: number }[];
  throughputByWeek: { week: string; count: number }[];
  groupBreakdown: GroupTimeEntry[];
  issueStatusCounts: { status: string; count: number }[];
  rows: ProjectRollupJobRow[];
};

export type ProjectRollupReportResult =
  | { ok: true; hasScope: true; data: ProjectRollupReportData }
  | { ok: true; hasScope: false }
  | { ok: false; message: string };

/**
 * The project rollup report's own query + aggregation, pulled out of the
 * page component so the on-screen report and every export format run
 * from exactly one query — same reasoning as sla-compliance-data.ts.
 * allProjects (id/name/client_id for every project) is passed in rather
 * than fetched here, since the page already needs the full list for its
 * project dropdown and there's no reason to fetch it twice per request.
 */
export async function fetchProjectRollupReportData(
  supabase: AnySupabaseClient,
  filters: ProjectRollupFilters,
  allProjects: { id: string; client_id: string | null }[],
): Promise<ProjectRollupReportResult> {
  const { projectId, clientId, status, jobType, siteId, assignedTo, dateFrom, dateTo, groupBy } = filters;

  const hasScope = !!(projectId || clientId);
  if (!hasScope) return { ok: true, hasScope: false };

  let projectIds: string[];
  if (projectId) {
    projectIds = [projectId];
  } else {
    projectIds = allProjects.filter((p) => p.client_id === clientId).map((p) => p.id);
    if (projectIds.length === 0) projectIds = ["00000000-0000-0000-0000-000000000000"];
  }

  let query = supabase
    .from("jobs")
    .select(
      `id, job_number, status, scheduled_start, assigned_to, site_id,
       site:sites(name), assigned:users!jobs_assigned_to_fkey(name),
       status_events(to_status, occurred_at), job_details(submitted_at)`,
    )
    .in("project_id", projectIds)
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status as JobStatus);
  if (jobType) query = query.eq("job_type", jobType);
  if (siteId) query = query.eq("site_id", siteId);
  if (assignedTo) query = query.eq("assigned_to", assignedTo);
  if (dateFrom) query = query.gte("created_at", `${dateFrom}T00:00:00`);
  if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59`);

  const { data: jobs, error } = await query;
  if (error) return { ok: false, message: error.message };

  const rows = jobs ?? [];
  const jobIds = rows.map((j) => j.id);
  const { data: issues } = jobIds.length > 0 ? await supabase.from("issues").select("status, job_id").in("job_id", jobIds) : { data: [] };

  const statusCountsMap = new Map<JobStatus, number>();
  for (const r of rows) statusCountsMap.set(r.status, (statusCountsMap.get(r.status) ?? 0) + 1);
  const statusCounts = ALL_JOB_STATUSES.filter((s) => (statusCountsMap.get(s) ?? 0) > 0).map((s) => ({
    status: s,
    label: humanize(s),
    count: statusCountsMap.get(s) ?? 0,
  }));

  // Throughput: jobs the engineer has submitted, bucketed by the ISO week
  // (Monday) of that submission — same week-key convention as the
  // Timesheets board (scheduler/week.ts).
  const throughputByWeekMap = new Map<string, number>();
  for (const r of rows) {
    const submittedAt = r.job_details?.submitted_at;
    if (!submittedAt) continue;
    const weekKey = isoDate(mondayOf(new Date(submittedAt)));
    throughputByWeekMap.set(weekKey, (throughputByWeekMap.get(weekKey) ?? 0) + 1);
  }
  const throughputByWeek = Array.from(throughputByWeekMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, count]) => ({ week, count }));

  // Raw (unrounded) minutes summed across every job first, rounded once at
  // the end — the same principle worked-duration.ts documents for
  // computeEngineerDayMinutes: summing already-rounded per-job figures
  // would compound each job's independent rounding error.
  let rawWorkedTotal = 0;
  let rawTravelTotal = 0;
  const rawByEngineer = new Map<string, GroupTimeEntry & { rawWorked: number; rawTravel: number }>();
  const bySite = new Map<string, GroupTimeEntry & { rawWorked: number; rawTravel: number }>();
  const byStatusForGroup = new Map<string, GroupTimeEntry & { rawWorked: number; rawTravel: number }>();

  for (const r of rows) {
    const worked = computeWorkedMinutes(r.status_events ?? []) ?? 0;
    const travel = computeTravelMinutes(r.status_events ?? []) ?? 0;
    rawWorkedTotal += worked;
    rawTravelTotal += travel;

    const engineerKey = r.assigned_to ?? "unassigned";
    const engineerEntry = rawByEngineer.get(engineerKey) ?? {
      label: r.assigned?.name ?? "Unassigned",
      jobCount: 0,
      workedMinutes: 0,
      travelMinutes: 0,
      rawWorked: 0,
      rawTravel: 0,
    };
    engineerEntry.rawWorked += worked;
    engineerEntry.rawTravel += travel;
    engineerEntry.jobCount += 1;
    rawByEngineer.set(engineerKey, engineerEntry);

    const siteEntry = bySite.get(r.site_id) ?? {
      label: r.site?.name ?? "Unknown site",
      jobCount: 0,
      workedMinutes: 0,
      travelMinutes: 0,
      rawWorked: 0,
      rawTravel: 0,
    };
    siteEntry.rawWorked += worked;
    siteEntry.rawTravel += travel;
    siteEntry.jobCount += 1;
    bySite.set(r.site_id, siteEntry);

    const statusEntry = byStatusForGroup.get(r.status) ?? {
      label: humanize(r.status),
      jobCount: 0,
      workedMinutes: 0,
      travelMinutes: 0,
      rawWorked: 0,
      rawTravel: 0,
    };
    statusEntry.rawWorked += worked;
    statusEntry.rawTravel += travel;
    statusEntry.jobCount += 1;
    byStatusForGroup.set(r.status, statusEntry);
  }

  const groupMap = groupBy === "engineer" ? rawByEngineer : groupBy === "site" ? bySite : byStatusForGroup;
  const groupBreakdown = Array.from(groupMap.values())
    .map((g) => ({
      label: g.label,
      jobCount: g.jobCount,
      workedMinutes: roundToNearest15Minutes(g.rawWorked),
      travelMinutes: roundToNearest15Minutes(g.rawTravel),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const issueStatusCountsMap = new Map<string, number>();
  for (const i of issues ?? []) issueStatusCountsMap.set(i.status ?? "unknown", (issueStatusCountsMap.get(i.status ?? "unknown") ?? 0) + 1);
  const issueStatusCounts = Array.from(issueStatusCountsMap.entries()).map(([status, count]) => ({ status, count }));

  const jobRows: ProjectRollupJobRow[] = rows.map((job) => ({
    jobId: job.id,
    jobNumber: job.job_number,
    siteName: job.site?.name ?? "—",
    status: job.status,
    engineerName: job.assigned?.name ?? "Unassigned",
    scheduledStart: job.scheduled_start,
  }));

  return {
    ok: true,
    hasScope: true,
    data: {
      filters,
      groupByLabel: GROUP_BY_OPTIONS.find((o) => o.value === groupBy)?.label ?? "Status",
      jobCount: rows.length,
      workedMinutesTotal: roundToNearest15Minutes(rawWorkedTotal),
      travelMinutesTotal: roundToNearest15Minutes(rawTravelTotal),
      issueCount: (issues ?? []).length,
      statusCounts,
      throughputByWeek,
      groupBreakdown,
      issueStatusCounts,
      rows: jobRows,
    },
  };
}
