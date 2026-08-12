import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { applyJobListFilters, hasAnyFilter, parseJobListFilters, type JobListSearchParams } from "@/lib/jobs/list-query";

const PAGE_SIZE = 50;
const JOB_STATUSES: Database["public"]["Enums"]["job_status"][] = [
  "draft",
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
];

function param(searchParams: JobListSearchParams, key: string): string {
  const value = searchParams[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

/**
 * Every job here can produce a report — a job report is "as applicable"
 * (per the feature request): missing form answers, photos, or signatures
 * just make for a shorter PDF/zip (see generateCompletionReport), so this
 * page isn't filtered down to completed/approved jobs only. Downloads hit
 * /api/jobs/[id]/report/{pdf,zip}, which generate fresh on every request
 * rather than reusing jobs.completion_pdf_url (that field only exists
 * post-approval and can go stale) — see that route's comment.
 */
export default async function ReportsPage({ searchParams }: { searchParams: Promise<JobListSearchParams> }) {
  const sp = await searchParams;
  const filters = parseJobListFilters(sp);
  const { status, q } = filters;
  const page = Math.max(1, Number(param(sp, "page")) || 1);

  const supabase = await createClient();
  const query = applyJobListFilters(
    supabase
      .from("jobs")
      .select("id, job_number, status, scheduled_start, site:sites(name), project:projects(name)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    filters,
  );
  const { data: jobs, count, error } = await query;
  if (error) {
    return <p className="text-destructive">Failed to load jobs: {error.message}</p>;
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Reports</h1>
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
            {JOB_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
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
              <TableCell colSpan={6} className="text-muted-foreground text-center">
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
              <TableCell>{job.site?.name ?? "—"}</TableCell>
              <TableCell>{job.project?.name ?? "—"}</TableCell>
              <TableCell>
                <Badge variant="secondary">{job.status}</Badge>
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
