import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { applyJobListFilters, hasAnyFilter, parseJobListFilters, type JobListSearchParams } from "@/lib/jobs/list-query";
import { JOB_TYPES, JOB_TYPE_LABELS } from "@/lib/forms/job-form";
import { humanize } from "@/lib/format/text";

const PAGE_SIZE = 50;
// Reports only makes sense for a job that's actually finished, one way or
// another — "closed" (completed, approved through QA), "cancelled", or
// "revisit" (QA-rejected, redone on a new linked job — see rejectJob). A job
// still in progress has no meaningful report to produce yet. Narrower than
// the full job_status enum on purpose: might need to open this back up to
// every status later (per the feature request that raised this), at which
// point this becomes a filter option rather than a hard restriction.
const REPORT_STATUSES: Database["public"]["Enums"]["job_status"][] = ["closed", "cancelled", "revisit"];

function param(searchParams: JobListSearchParams, key: string): string {
  const value = searchParams[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

/**
 * Only closed (completed), cancelled, or revisit (QA-rejected) jobs are
 * listed — a report only makes sense for a job that's actually finished,
 * one way or another (see REPORT_STATUSES above). Within that, a report is
 * still "as applicable": missing form answers, photos, or signatures just
 * make for a shorter PDF/zip (see generateCompletionReport), not a reason
 * to exclude the job. Downloads hit /api/jobs/[id]/report/{pdf,zip}, which
 * generate fresh on every request rather than reusing jobs.completion_pdf_url
 * (that field only exists post-approval and can go stale) — see that
 * route's comment.
 */
export default async function ReportsPage({ searchParams }: { searchParams: Promise<JobListSearchParams> }) {
  const sp = await searchParams;
  const filters = parseJobListFilters(sp);
  const { status, jobType, projectId, assignedTo, clientId, siteId, q } = filters;
  const page = Math.max(1, Number(param(sp, "page")) || 1);

  const supabase = await createClient();

  // clientId isn't a jobs column (only site_id is — a site belongs to a
  // client), so it's resolved to that client's site ids here and folded in
  // as an extra .in("site_id", ...) alongside whatever applyJobListFilters
  // already applied (including a specific siteId, if also set — the two
  // combine as a normal AND, same as any other pair of filters).
  const clientSiteIds = clientId ? (await supabase.from("sites").select("id").eq("client_id", clientId)).data?.map((s) => s.id) ?? [] : null;

  let query = applyJobListFilters(
    supabase
      .from("jobs")
      .select(
        "id, job_number, status, scheduled_start, site:sites(name, client:clients(name)), project:projects(name)",
        { count: "exact" },
      )
      .in("status", REPORT_STATUSES)
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    filters,
  );
  if (clientSiteIds) query = query.in("site_id", clientSiteIds.length > 0 ? clientSiteIds : ["00000000-0000-0000-0000-000000000000"]);

  const [{ data: jobs, count, error }, { data: projects }, { data: engineers }, { data: clients }, { data: sites }] =
    await Promise.all([
      query,
      supabase.from("projects").select("id, name").order("name"),
      supabase.from("users").select("id, name").in("role", ["engineer", "manager"]).eq("active", true).order("name"),
      supabase.from("clients").select("id, name").order("name"),
      supabase.from("sites").select("id, name, client_id").order("name"),
    ]);

  if (error) {
    return <p className="text-destructive">Failed to load jobs: {error.message}</p>;
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Completed Jobs</h1>
        <span className="text-muted-foreground text-sm">{total} jobs</span>
      </div>

      <form className="flex flex-wrap items-end gap-2" method="get">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground" htmlFor="q">
            Search job #
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="UXG-2026-0001"
            className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground" htmlFor="status">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status}
            className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            <option value="">All</option>
            {REPORT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground" htmlFor="job_type">
            Job type
          </label>
          <select
            id="job_type"
            name="job_type"
            defaultValue={jobType}
            className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            <option value="">All</option>
            {JOB_TYPES.map((t) => (
              <option key={t} value={t}>
                {JOB_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground" htmlFor="client_id">
            Client
          </label>
          <select
            id="client_id"
            name="client_id"
            defaultValue={clientId}
            className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            <option value="">All</option>
            {(clients ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground" htmlFor="site_id">
            Site
          </label>
          <select
            id="site_id"
            name="site_id"
            defaultValue={siteId}
            className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            <option value="">All</option>
            {(sites ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground" htmlFor="project_id">
            Project
          </label>
          <select
            id="project_id"
            name="project_id"
            defaultValue={projectId}
            className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            <option value="">All</option>
            {(projects ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground" htmlFor="assigned_to">
            Assigned to
          </label>
          <select
            id="assigned_to"
            name="assigned_to"
            defaultValue={assignedTo}
            className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            <option value="">Anyone</option>
            <option value="unassigned">Unassigned</option>
            {(engineers ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="border-input h-9 rounded-md border px-4 text-sm hover:bg-accent">
          Filter
        </button>
        {hasAnyFilter(filters) && (
          <Link href="/office/reports" className="text-sm text-muted-foreground underline">
            Clear
          </Link>
        )}
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Job #</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Site</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Scheduled</TableHead>
            <TableHead>Report</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(jobs ?? []).length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-muted-foreground text-center">
                No jobs match these filters.
              </TableCell>
            </TableRow>
          )}
          {(jobs ?? []).map((job) => (
            <TableRow key={job.id}>
              <TableCell>
                <Link href={`/office/jobs/${job.id}`} className="font-medium underline-offset-2 hover:underline">
                  {job.job_number}
                </Link>
              </TableCell>
              <TableCell>{job.site?.client?.name ?? "—"}</TableCell>
              <TableCell>{job.site?.name ?? "—"}</TableCell>
              <TableCell>{job.project?.name ?? "—"}</TableCell>
              <TableCell>
                <Badge variant="secondary">{humanize(job.status)}</Badge>
              </TableCell>
              <TableCell>{job.scheduled_start ? new Date(job.scheduled_start).toLocaleString() : "—"}</TableCell>
              <TableCell>
                <div className="flex gap-3 text-sm">
                  <a href={`/api/jobs/${job.id}/report/pdf`} className="underline-offset-2 hover:underline">
                    PDF
                  </a>
                  <a href={`/api/jobs/${job.id}/report/zip`} className="underline-offset-2 hover:underline">
                    Zip
                  </a>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link
              className="border-input rounded-md border px-3 py-1 hover:bg-accent"
              href={`?${new URLSearchParams({ ...sp, page: String(page - 1) } as Record<string, string>).toString()}`}
            >
              Previous
            </Link>
          )}
          {page < totalPages && (
            <Link
              className="border-input rounded-md border px-3 py-1 hover:bg-accent"
              href={`?${new URLSearchParams({ ...sp, page: String(page + 1) } as Record<string, string>).toString()}`}
            >
              Next
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
