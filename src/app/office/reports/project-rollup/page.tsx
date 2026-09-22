import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/office/stat-tile";
import { createClient } from "@/lib/supabase/server";
import { fetchProjectRollupReportData, ALL_JOB_STATUSES, GROUP_BY_OPTIONS, type GroupBy } from "@/lib/reports/project-rollup-data";
import { JOB_TYPES, JOB_TYPE_LABELS } from "@/lib/forms/job-form";
import { humanize } from "@/lib/format/text";

type SearchParams = Record<string, string | string[] | undefined>;

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
 * Query/aggregation is shared with every export format via
 * lib/reports/project-rollup-data.ts — this page is filter-form +
 * presentation only.
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

  const result = await fetchProjectRollupReportData(
    supabase,
    { projectId, clientId, status, jobType, siteId, assignedTo, dateFrom, dateTo, groupBy },
    allProjects ?? [],
  );

  if (!result.ok) {
    return <p className="text-destructive">Failed to load the project rollup report: {result.message}</p>;
  }

  const hasFilters = !!(status || jobType || siteId || assignedTo || dateFrom || dateTo);
  const scopeParams: Record<string, string> = {};
  if (projectId) scopeParams.project_id = projectId;
  if (clientId) scopeParams.client_id = clientId;
  const exportParams = new URLSearchParams({
    ...scopeParams,
    ...(status && { status }),
    ...(jobType && { job_type: jobType }),
    ...(siteId && { site_id: siteId }),
    ...(assignedTo && { assigned_to: assignedTo }),
    ...(dateFrom && { date_from: dateFrom }),
    ...(dateTo && { date_to: dateTo }),
    group_by: groupBy,
  }).toString();

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
          <Link href="/office/report-generator" className="underline-offset-2 hover:underline">
            Report Generator
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

      {!result.hasScope && (
        <p className="text-muted-foreground rounded-md border p-6 text-center text-sm">
          Choose a customer and/or a project above, then run the report.
        </p>
      )}

      {result.hasScope && (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted-foreground">Export this view:</span>
            <a href={`/api/reports/project-rollup/pdf?${exportParams}`} className="border-input rounded-md border px-3 py-1.5 hover:bg-accent">
              PDF
            </a>
            <a href={`/api/reports/project-rollup/xlsx?${exportParams}`} className="border-input rounded-md border px-3 py-1.5 hover:bg-accent">
              Excel
            </a>
            <a href={`/api/reports/project-rollup/csv?${exportParams}`} className="border-input rounded-md border px-3 py-1.5 hover:bg-accent">
              CSV
            </a>
            <a href={`/api/reports/project-rollup/zip?${exportParams}`} className="border-input rounded-md border px-3 py-1.5 hover:bg-accent">
              Zip (all formats)
            </a>
          </div>

          <div className="flex flex-wrap gap-4">
            <StatTile label="Jobs in scope" value={String(result.data.jobCount)} />
            <StatTile label="Worked time" value={formatMinutes(result.data.workedMinutesTotal)} />
            <StatTile label="Travel time" value={formatMinutes(result.data.travelMinutesTotal)} />
            <StatTile label="Issues raised" value={String(result.data.issueCount)} />
          </div>

          <div>
            <h2 className="mb-2 text-lg font-semibold">Jobs by status</h2>
            <div className="flex flex-wrap gap-2">
              {result.data.statusCounts.map((s) => (
                <Badge key={s.status} variant="secondary">
                  {s.label}: {s.count}
                </Badge>
              ))}
              {result.data.statusCounts.length === 0 && <span className="text-muted-foreground text-sm">No jobs in scope yet.</span>}
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-lg font-semibold">Throughput (jobs submitted per week)</h2>
            {result.data.throughputByWeek.length === 0 ? (
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
                    {result.data.throughputByWeek.map(({ week, count }) => (
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
            <h2 className="mb-2 text-lg font-semibold">Breakdown by {result.data.groupByLabel.toLowerCase()}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 font-medium">{result.data.groupByLabel}</th>
                    <th className="py-2 font-medium">Jobs</th>
                    <th className="py-2 font-medium">Worked</th>
                    <th className="py-2 font-medium">Travel</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.groupBreakdown.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-muted-foreground py-4 text-center">
                        No jobs match these filters.
                      </td>
                    </tr>
                  )}
                  {result.data.groupBreakdown.map((g) => (
                    <tr key={g.label} className="border-b">
                      <td className="py-2">{g.label}</td>
                      <td className="py-2 tabular-nums">{g.jobCount}</td>
                      <td className="py-2 tabular-nums">{formatMinutes(g.workedMinutes)}</td>
                      <td className="py-2 tabular-nums">{formatMinutes(g.travelMinutes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-lg font-semibold">Issues by state</h2>
            <div className="flex flex-wrap gap-2">
              {result.data.issueStatusCounts.map(({ status: s, count }) => (
                <Badge key={s} variant="outline">
                  {humanize(s)}: {count}
                </Badge>
              ))}
              {result.data.issueStatusCounts.length === 0 && <span className="text-muted-foreground text-sm">No issues raised in scope.</span>}
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
                  {result.data.rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-muted-foreground py-6 text-center">
                        No jobs match these filters.
                      </td>
                    </tr>
                  )}
                  {result.data.rows.map((job) => (
                    <tr key={job.jobId} className="border-b">
                      <td className="py-2">
                        <Link href={`/office/jobs/${job.jobId}`} className="font-medium underline-offset-2 hover:underline">
                          {job.jobNumber}
                        </Link>
                      </td>
                      <td className="py-2 text-muted-foreground">{job.siteName}</td>
                      <td className="py-2">
                        <Badge variant="secondary">{humanize(job.status)}</Badge>
                      </td>
                      <td className="py-2 text-muted-foreground">{job.engineerName}</td>
                      <td className="py-2 text-muted-foreground">{job.scheduledStart ? new Date(job.scheduledStart).toLocaleString() : "—"}</td>
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
