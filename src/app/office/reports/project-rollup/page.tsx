import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/office/stat-tile";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { computeWorkedMinutes, computeTravelMinutes, roundToNearest15Minutes } from "@/lib/jobs/worked-duration";
import { isoDate, mondayOf } from "@/lib/scheduler/week";
import { JOB_TYPES, JOB_TYPE_LABELS } from "@/lib/forms/job-form";
import { humanize } from "@/lib/format/text";

type SearchParams = Record<string, string | string[] | undefined>;
type JobStatus = Database["public"]["Enums"]["job_status"];
const ALL_JOB_STATUSES: JobStatus[] = [
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

type GroupBy = "status" | "engineer" | "site";
const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: "status", label: "Status" },
  { value: "engineer", label: "Engineer" },
  { value: "site", label: "Site" },
];

function param(sp: SearchParams, key: string): string {
  const value = sp[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Project rollup report — Report Generator Phase 1, per the Report
 * Generator Blueprint. A project spans sites (see projects' own comment
 * in database.types.ts), so this report crosses site boundaries by
 * design — Asset Register/Job Sheets are site-scoped, not project-scoped,
 * so this deliberately doesn't try to roll up equipment.
 *
 * Scope is project and/or client: a specific project id, or every
 * project belonging to a client (rolled up). Archived projects stay
 * visible here on purpose (see 20260918000000_project_archive.sql —
 * archiving hides a project from active pickers, not from reporting).
 */
export default async function ProjectRollupReportPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const projectId = param(sp, "project_id");
  const clientId = param(sp, "client_id");
  const status = param(sp, "status");
  const jobType = param(sp, "job_type");
  const siteId = param(sp, "site_id");
  const assignedTo = param(sp, "assigned_to");
  const dateFrom = param(sp, "date_from");
  const dateTo = param(sp, "date_to");
  const groupBy = (param(sp, "group_by") || "status") as GroupBy;

  const supabase = await createClient();

  const [{ data: clients }, { data: allProjects }, { data: sites }, { data: engineers }] = await Promise.all([
    supabase.from("clients").select("id, name").order("name"),
    supabase.from("projects").select("id, name, client_id").order("name"),
    supabase.from("sites").select("id, name").order("name"),
    supabase.from("users").select("id, name").in("role", ["engineer", "manager", "superadmin"]).eq("active", true).order("name"),
  ]);

  const hasScope = !!(projectId || clientId);
  let projectIds: string[] | null = null;
  if (projectId) {
    projectIds = [projectId];
  } else if (clientId) {
    projectIds = (allProjects ?? []).filter((p) => p.client_id === clientId).map((p) => p.id);
    if (projectIds.length === 0) projectIds = ["00000000-0000-0000-0000-000000000000"];
  }

  function scopedJobsQuery(ids: string[]) {
    let query = supabase
      .from("jobs")
      .select(
        `id, job_number, status, scheduled_start, assigned_to, site_id,
         site:sites(name), assigned:users!jobs_assigned_to_fkey(name),
         status_events(to_status, occurred_at), job_details(submitted_at)`,
      )
      .in("project_id", ids)
      .order("created_at", { ascending: false });
    if (status) query = query.eq("status", status as JobStatus);
    if (jobType) query = query.eq("job_type", jobType);
    if (siteId) query = query.eq("site_id", siteId);
    if (assignedTo) query = query.eq("assigned_to", assignedTo);
    if (dateFrom) query = query.gte("created_at", `${dateFrom}T00:00:00`);
    if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59`);
    return query;
  }

  let jobs: Awaited<ReturnType<typeof scopedJobsQuery>>["data"] = [];
  let error: string | null = null;

  if (hasScope && projectIds) {
    const result = await scopedJobsQuery(projectIds);
    if (result.error) error = result.error.message;
    else jobs = result.data ?? [];
  }

  if (error) {
    return <p className="text-destructive">Failed to load the project rollup report: {error}</p>;
  }

  const rows = jobs ?? [];
  const jobIds = rows.map((j) => j.id);
  const { data: issues } = jobIds.length > 0 ? await supabase.from("issues").select("status, job_id").in("job_id", jobIds) : { data: [] };

  const statusCounts = new Map<JobStatus, number>();
  for (const r of rows) statusCounts.set(r.status, (statusCounts.get(r.status) ?? 0) + 1);

  // Throughput: jobs the engineer has submitted, bucketed by the ISO week
  // (Monday) of that submission — same week-key convention as the
  // Timesheets board (scheduler/week.ts), so this lines up with it if
  // compared side by side.
  const throughputByWeek = new Map<string, number>();
  for (const r of rows) {
    const submittedAt = r.job_details?.submitted_at;
    if (!submittedAt) continue;
    const weekKey = isoDate(mondayOf(new Date(submittedAt)));
    throughputByWeek.set(weekKey, (throughputByWeek.get(weekKey) ?? 0) + 1);
  }
  const throughputWeeks = Array.from(throughputByWeek.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  // Raw (unrounded) minutes summed across every job first, rounded once at
  // the end — the same principle worked-duration.ts documents for
  // computeEngineerDayMinutes: summing already-rounded per-job figures
  // would compound each job's independent rounding error.
  let rawWorkedTotal = 0;
  let rawTravelTotal = 0;
  const rawByEngineer = new Map<string, { label: string; worked: number; travel: number; jobCount: number }>();
  const bySite = new Map<string, { label: string; worked: number; travel: number; jobCount: number }>();
  const byStatusForGroup = new Map<string, { label: string; worked: number; travel: number; jobCount: number }>();

  for (const r of rows) {
    const worked = computeWorkedMinutes(r.status_events ?? []) ?? 0;
    const travel = computeTravelMinutes(r.status_events ?? []) ?? 0;
    rawWorkedTotal += worked;
    rawTravelTotal += travel;

    const engineerKey = r.assigned_to ?? "unassigned";
    const engineerEntry = rawByEngineer.get(engineerKey) ?? { label: r.assigned?.name ?? "Unassigned", worked: 0, travel: 0, jobCount: 0 };
    engineerEntry.worked += worked;
    engineerEntry.travel += travel;
    engineerEntry.jobCount += 1;
    rawByEngineer.set(engineerKey, engineerEntry);

    const siteEntry = bySite.get(r.site_id) ?? { label: r.site?.name ?? "Unknown site", worked: 0, travel: 0, jobCount: 0 };
    siteEntry.worked += worked;
    siteEntry.travel += travel;
    siteEntry.jobCount += 1;
    bySite.set(r.site_id, siteEntry);

    const statusEntry = byStatusForGroup.get(r.status) ?? { label: humanize(r.status), worked: 0, travel: 0, jobCount: 0 };
    statusEntry.worked += worked;
    statusEntry.travel += travel;
    statusEntry.jobCount += 1;
    byStatusForGroup.set(r.status, statusEntry);
  }

  const groupMap = groupBy === "engineer" ? rawByEngineer : groupBy === "site" ? bySite : byStatusForGroup;
  const groupBreakdown = Array.from(groupMap.values())
    .map((g) => ({ ...g, workedRounded: roundToNearest15Minutes(g.worked), travelRounded: roundToNearest15Minutes(g.travel) }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const issueStatusCounts = new Map<string, number>();
  for (const i of issues ?? []) issueStatusCounts.set(i.status ?? "unknown", (issueStatusCounts.get(i.status ?? "unknown") ?? 0) + 1);

  const hasFilters = !!(status || jobType || siteId || assignedTo || dateFrom || dateTo);
  const scopeParams: Record<string, string> = {};
  if (projectId) scopeParams.project_id = projectId;
  if (clientId) scopeParams.client_id = clientId;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Project Rollup Report</h1>
          <p className="text-muted-foreground text-sm">
            Cross-job view of a single project, or every project belonging to one customer rolled up together.
          </p>
        </div>
        <div className="flex gap-3 text-sm whitespace-nowrap">
          <Link href="/office/reports" className="underline-offset-2 hover:underline">
            Completed Jobs
          </Link>
          <Link href="/office/reports/sla-compliance" className="underline-offset-2 hover:underline">
            SLA compliance
          </Link>
        </div>
      </div>

      <form className="flex flex-wrap items-end gap-2" method="get">
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs" htmlFor="client_id">
            Customer
          </label>
          <select id="client_id" name="client_id" defaultValue={clientId} className="border-input h-9 rounded-md border bg-transparent px-3 text-sm">
            <option value="">Select…</option>
            {(clients ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs" htmlFor="project_id">
            Project
          </label>
          <select id="project_id" name="project_id" defaultValue={projectId} className="border-input h-9 rounded-md border bg-transparent px-3 text-sm">
            <option value="">Select…</option>
            {(allProjects ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs" htmlFor="status">
            Status
          </label>
          <select id="status" name="status" defaultValue={status} className="border-input h-9 rounded-md border bg-transparent px-3 text-sm">
            <option value="">All</option>
            {ALL_JOB_STATUSES.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs" htmlFor="job_type">
            Job type
          </label>
          <select id="job_type" name="job_type" defaultValue={jobType} className="border-input h-9 rounded-md border bg-transparent px-3 text-sm">
            <option value="">All</option>
            {JOB_TYPES.map((t) => (
              <option key={t} value={t}>
                {JOB_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs" htmlFor="site_id">
            Site
          </label>
          <select id="site_id" name="site_id" defaultValue={siteId} className="border-input h-9 rounded-md border bg-transparent px-3 text-sm">
            <option value="">All</option>
            {(sites ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs" htmlFor="assigned_to">
            Engineer
          </label>
          <select id="assigned_to" name="assigned_to" defaultValue={assignedTo} className="border-input h-9 rounded-md border bg-transparent px-3 text-sm">
            <option value="">Anyone</option>
            {(engineers ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs" htmlFor="date_from">
            From
          </label>
          <input id="date_from" type="date" name="date_from" defaultValue={dateFrom} className="border-input h-9 rounded-md border bg-transparent px-3 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs" htmlFor="date_to">
            To
          </label>
          <input id="date_to" type="date" name="date_to" defaultValue={dateTo} className="border-input h-9 rounded-md border bg-transparent px-3 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs" htmlFor="group_by">
            Group by
          </label>
          <select id="group_by" name="group_by" defaultValue={groupBy} className="border-input h-9 rounded-md border bg-transparent px-3 text-sm">
            {GROUP_BY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="border-input h-9 rounded-md border px-4 text-sm hover:bg-accent">
          Run report
        </button>
        {hasFilters && (
          <Link href={`/office/reports/project-rollup?${new URLSearchParams(scopeParams).toString()}`} className="text-muted-foreground text-sm underline">
            Clear filters
          </Link>
        )}
      </form>

      {!hasScope && (
        <p className="text-muted-foreground rounded-md border p-6 text-center text-sm">
          Choose a customer and/or a project above, then run the report.
        </p>
      )}

      {hasScope && (
        <>
          <div className="flex flex-wrap gap-4">
            <StatTile label="Jobs in scope" value={String(rows.length)} />
            <StatTile label="Worked time" value={formatMinutes(roundToNearest15Minutes(rawWorkedTotal))} />
            <StatTile label="Travel time" value={formatMinutes(roundToNearest15Minutes(rawTravelTotal))} />
            <StatTile label="Issues raised" value={String((issues ?? []).length)} />
          </div>

          <div>
            <h2 className="mb-2 text-lg font-semibold">Jobs by status</h2>
            <div className="flex flex-wrap gap-2">
              {ALL_JOB_STATUSES.filter((s) => (statusCounts.get(s) ?? 0) > 0).map((s) => (
                <Badge key={s} variant="secondary">
                  {humanize(s)}: {statusCounts.get(s)}
                </Badge>
              ))}
              {rows.length === 0 && <span className="text-muted-foreground text-sm">No jobs in scope yet.</span>}
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-lg font-semibold">Throughput (jobs submitted per week)</h2>
            {throughputWeeks.length === 0 ? (
              <p className="text-muted-foreground text-sm">No jobs submitted yet in scope.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 font-medium">Week of</th>
                      <th className="py-2 font-medium">Jobs submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {throughputWeeks.map(([week, count]) => (
                      <tr key={week} className="border-b">
                        <td className="py-2">{new Date(week).toLocaleDateString()}</td>
                        <td className="py-2 tabular-nums">{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-2 text-lg font-semibold">
              Breakdown by {GROUP_BY_OPTIONS.find((o) => o.value === groupBy)?.label.toLowerCase()}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 font-medium">{GROUP_BY_OPTIONS.find((o) => o.value === groupBy)?.label}</th>
                    <th className="py-2 font-medium">Jobs</th>
                    <th className="py-2 font-medium">Worked</th>
                    <th className="py-2 font-medium">Travel</th>
                  </tr>
                </thead>
                <tbody>
                  {groupBreakdown.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-muted-foreground py-4 text-center">
                        No jobs match these filters.
                      </td>
                    </tr>
                  )}
                  {groupBreakdown.map((g) => (
                    <tr key={g.label} className="border-b">
                      <td className="py-2">{g.label}</td>
                      <td className="py-2 tabular-nums">{g.jobCount}</td>
                      <td className="py-2 tabular-nums">{formatMinutes(g.workedRounded)}</td>
                      <td className="py-2 tabular-nums">{formatMinutes(g.travelRounded)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-lg font-semibold">Issues by state</h2>
            <div className="flex flex-wrap gap-2">
              {Array.from(issueStatusCounts.entries()).map(([s, count]) => (
                <Badge key={s} variant="outline">
                  {humanize(s)}: {count}
                </Badge>
              ))}
              {(issues ?? []).length === 0 && <span className="text-muted-foreground text-sm">No issues raised in scope.</span>}
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-lg font-semibold">Jobs</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 font-medium">Job #</th>
                    <th className="py-2 font-medium">Site</th>
                    <th className="py-2 font-medium">Status</th>
                    <th className="py-2 font-medium">Engineer</th>
                    <th className="py-2 font-medium">Scheduled</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-muted-foreground py-6 text-center">
                        No jobs match these filters.
                      </td>
                    </tr>
                  )}
                  {rows.map((job) => (
                    <tr key={job.id} className="border-b">
                      <td className="py-2">
                        <Link href={`/office/jobs/${job.id}`} className="font-medium underline-offset-2 hover:underline">
                          {job.job_number}
                        </Link>
                      </td>
                      <td className="py-2 text-muted-foreground">{job.site?.name ?? "—"}</td>
                      <td className="py-2">
                        <Badge variant="secondary">{humanize(job.status)}</Badge>
                      </td>
                      <td className="py-2 text-muted-foreground">{job.assigned?.name ?? "Unassigned"}</td>
                      <td className="py-2 text-muted-foreground">{job.scheduled_start ? new Date(job.scheduled_start).toLocaleString() : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
