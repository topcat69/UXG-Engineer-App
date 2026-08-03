import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { JobsTable, type JobRow } from "./jobs-table";

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
const JOB_TYPES = ["install", "survey"];

type SearchParams = Record<string, string | string[] | undefined>;

function param(searchParams: SearchParams, key: string): string {
  const value = searchParams[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function JobsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const status = param(sp, "status");
  const jobType = param(sp, "job_type");
  const projectId = param(sp, "project_id");
  const assignedTo = param(sp, "assigned_to");
  const q = param(sp, "q");
  const page = Math.max(1, Number(param(sp, "page")) || 1);

  const supabase = await createClient();

  let query = supabase
    .from("jobs")
    .select(
      "id, job_number, job_type, status, priority, scheduled_start, assigned_to, site:sites(name), project:projects(name), assigned:users!jobs_assigned_to_fkey(name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (status) query = query.eq("status", status as Database["public"]["Enums"]["job_status"]);
  if (jobType) query = query.eq("job_type", jobType);
  if (projectId) query = query.eq("project_id", projectId);
  if (assignedTo === "unassigned") query = query.is("assigned_to", null);
  else if (assignedTo) query = query.eq("assigned_to", assignedTo);
  if (q) query = query.ilike("job_number", `%${q}%`);

  const [{ data: jobs, count, error }, { data: projects }, { data: engineers }] = await Promise.all([
    query,
    supabase.from("projects").select("id, name").order("name"),
    supabase.from("users").select("id, name").eq("role", "engineer").eq("active", true).order("name"),
  ]);

  if (error) {
    return <p className="text-destructive">Failed to load jobs: {error.message}</p>;
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Jobs</h1>
        <span className="text-muted-foreground text-sm">{total} total</span>
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
            placeholder="OPOC-2026-0001"
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
                {t}
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
        <button
          type="submit"
          className="border-input h-9 rounded-md border px-4 text-sm hover:bg-accent"
        >
          Filter
        </button>
        {(status || jobType || projectId || assignedTo || q) && (
          <Link href="/office/jobs" className="text-sm text-muted-foreground underline">
            Clear
          </Link>
        )}
      </form>

      <JobsTable jobs={(jobs ?? []) as unknown as JobRow[]} engineers={engineers ?? []} />

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
