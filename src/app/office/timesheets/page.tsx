import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { applyJobListFilters, hasAnyFilter, parseJobListFilters, type JobListSearchParams } from "@/lib/jobs/list-query";
import {
  computeEngineerDayMinutes,
  computeTimesheetMinutes,
  TIMESHEET_STATUSES,
  type StatusEventForDuration,
} from "@/lib/jobs/worked-duration";
import { addDays, isoDate, mondayOf } from "@/lib/scheduler/week";
import { humanize } from "@/lib/format/text";
import { TimesheetBoard } from "./timesheet-board";

const PAGE_SIZE = 50;

// Same "one row per job" shape confirmed in scoping: a multi-site day
// already produces one job per site, so it's naturally covered without
// any extra grouping.

function param(searchParams: JobListSearchParams, key: string): string {
  const value = searchParams[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function formatMinutes(minutes: number | null): string {
  if (minutes === null) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default async function TimesheetsPage({ searchParams }: { searchParams: Promise<JobListSearchParams> }) {
  const sp = await searchParams;
  const filters = parseJobListFilters(sp);
  const { projectId, assignedTo, q } = filters;
  const page = Math.max(1, Number(param(sp, "page")) || 1);

  const weekParam = param(sp, "week");
  const monday = weekParam ? mondayOf(new Date(weekParam)) : mondayOf(new Date());
  const weekEnd = addDays(monday, 7);
  const days = Array.from({ length: 7 }, (_, i) => isoDate(addDays(monday, i)));
  const prevWeek = isoDate(addDays(monday, -7));
  const nextWeek = isoDate(addDays(monday, 7));

  const supabase = await createClient();

  const query = applyJobListFilters(
    supabase
      .from("jobs")
      .select(
        `id, job_number, status, scheduled_start, site:sites(name, client:clients(name)), project:projects(name),
         assigned:users!jobs_assigned_to_fkey(name), status_events(to_status, occurred_at)`,
        { count: "exact" },
      )
      .in("status", TIMESHEET_STATUSES)
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    filters,
  );

  const weekJobColumns = "assigned_to, scheduled_start, scheduled_end, status_events(to_status, occurred_at)";

  const [{ data: jobs, count, error }, { data: projects }, { data: engineers }, { data: weekJobs }, { data: spanningJobs }] =
    await Promise.all([
      query,
      supabase.from("projects").select("id, name").order("name"),
      supabase.from("users").select("id, name").in("role", ["engineer", "manager", "superadmin"]).eq("active", true).order("name"),
      supabase
        .from("jobs")
        .select(weekJobColumns)
        .in("status", TIMESHEET_STATUSES)
        .not("assigned_to", "is", null)
        .gte("scheduled_start", monday.toISOString())
        .lt("scheduled_start", weekEnd.toISOString()),
      // Multi-day jobs that started before this week but whose work could
      // still run into it — same "spanning" query the scheduler board uses
      // to keep a job visible on every day it touches, not just its start day.
      supabase
        .from("jobs")
        .select(weekJobColumns)
        .in("status", TIMESHEET_STATUSES)
        .not("assigned_to", "is", null)
        .lt("scheduled_start", monday.toISOString())
        .gte("scheduled_end", monday.toISOString()),
    ]);

  if (error) {
    return <p className="text-destructive">Failed to load timesheets: {error.message}</p>;
  }

  const rows = (jobs ?? []).map((job) => ({
    ...job,
    minutes: computeTimesheetMinutes((job.status_events ?? []) as StatusEventForDuration[]),
  }));

  const weekJobRows = [...(weekJobs ?? []), ...(spanningJobs ?? [])];
  const engineerDayMinutesMap = computeEngineerDayMinutes(
    weekJobRows.map((j) => ({ assignedTo: j.assigned_to, events: (j.status_events ?? []) as StatusEventForDuration[] })),
  );
  // Map isn't serialisable across the server/client component boundary,
  // so flatten it to a plain object before handing it to TimesheetBoard.
  const minutesByEngineer: Record<string, Record<string, { travelMinutes: number; workMinutes: number; totalMinutes: number }>> = {};
  for (const [engineerId, dayMap] of engineerDayMinutesMap) {
    minutesByEngineer[engineerId] = {};
    for (const [day, m] of dayMap) {
      minutesByEngineer[engineerId][day] = {
        travelMinutes: m.travelMinutes ?? 0,
        workMinutes: m.workMinutes ?? 0,
        totalMinutes: m.totalMinutes ?? 0,
      };
    }
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const exportHref = `/api/export/timesheets?${new URLSearchParams(sp as Record<string, string>).toString()}`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Timesheets</h1>
          <div className="flex items-center gap-3 text-sm whitespace-nowrap">
            <Link href={`?week=${prevWeek}`} className="border-input rounded-md border px-3 py-1 hover:bg-accent">
              ← Previous week
            </Link>
            <span className="text-muted-foreground">
              {monday.toLocaleDateString()} – {addDays(monday, 6).toLocaleDateString()}
            </span>
            <Link href={`?week=${nextWeek}`} className="border-input rounded-md border px-3 py-1 hover:bg-accent">
              Next week →
            </Link>
          </div>
        </div>
        <p className="text-muted-foreground text-sm">
          Travel and on-site work time per engineer per day, computed from each job&apos;s own status history and split
          across UTC midnight for anything that runs past it. Each day&apos;s figures are rounded to the nearest 15
          minutes.
        </p>
      </div>

      <TimesheetBoard days={days} engineers={engineers ?? []} minutesByEngineer={minutesByEngineer} />

      <hr className="border-t" />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Search jobs</h2>
          <p className="text-muted-foreground text-sm">
            One row per job, from the moment an engineer starts travelling until the job is submitted. Each figure is
            rounded to the nearest 15 minutes independently, so Total isn&apos;t always Travel + Work added after
            rounding.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm whitespace-nowrap">
          <span className="text-muted-foreground">{total} jobs</span>
          <Link href={exportHref} className="border-input rounded-md border px-3 py-1.5 hover:bg-accent">
            Export CSV
          </Link>
        </div>
      </div>

      <form className="flex flex-wrap items-end gap-2" method="get">
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs" htmlFor="q">
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
          <label className="text-muted-foreground text-xs" htmlFor="project_id">
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
          <label className="text-muted-foreground text-xs" htmlFor="assigned_to">
            Engineer
          </label>
          <select
            id="assigned_to"
            name="assigned_to"
            defaultValue={assignedTo}
            className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            <option value="">Anyone</option>
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
          <Link href="/office/timesheets" className="text-muted-foreground text-sm underline">
            Clear
          </Link>
        )}
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Job #</TableHead>
            <TableHead>Engineer</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Site</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Travel</TableHead>
            <TableHead>Work</TableHead>
            <TableHead>Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-muted-foreground text-center">
                No finished jobs match these filters.
              </TableCell>
            </TableRow>
          )}
          {rows.map((job) => (
            <TableRow key={job.id}>
              <TableCell>
                <Link href={`/office/jobs/${job.id}`} className="font-medium underline-offset-2 hover:underline">
                  {job.job_number}
                </Link>
              </TableCell>
              <TableCell>{job.assigned?.name ?? "—"}</TableCell>
              <TableCell>{job.site?.client?.name ?? "—"}</TableCell>
              <TableCell>{job.site?.name ?? "—"}</TableCell>
              <TableCell>
                <Badge variant="secondary">{humanize(job.status)}</Badge>
              </TableCell>
              <TableCell className="tabular-nums">{formatMinutes(job.minutes.travelMinutes)}</TableCell>
              <TableCell className="tabular-nums">{formatMinutes(job.minutes.workMinutes)}</TableCell>
              <TableCell className="font-medium tabular-nums">{formatMinutes(job.minutes.totalMinutes)}</TableCell>
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
