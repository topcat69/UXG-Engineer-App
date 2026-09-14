import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { applyJobListFilters, parseJobListFilters } from "@/lib/jobs/list-query";
import { timesheetsToCsv, type TimesheetExportRow } from "@/lib/csv/export";
import { computeTimesheetMinutes, TIMESHEET_STATUSES, type StatusEventForDuration } from "@/lib/jobs/worked-duration";

const EXPORT_ROW_LIMIT = 5000;

/** Same filters as /office/timesheets, via the shared parseJobListFilters/applyJobListFilters — see /api/export/jobs's own comment on why this matters. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const searchParams = Object.fromEntries(new URL(request.url).searchParams);
  const filters = parseJobListFilters(searchParams);

  const supabase = await createClient();
  const { data: jobs, error } = await applyJobListFilters(
    supabase
      .from("jobs")
      .select(
        `job_number, scheduled_start, site:sites(name, client:clients(name)),
         assigned:users!jobs_assigned_to_fkey(name), status_events(to_status, occurred_at)`,
      )
      .in("status", TIMESHEET_STATUSES)
      .order("created_at", { ascending: false })
      .limit(EXPORT_ROW_LIMIT),
    filters,
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows: TimesheetExportRow[] = (jobs ?? []).map((job) => {
    const minutes = computeTimesheetMinutes((job.status_events ?? []) as StatusEventForDuration[]);
    return {
      job_number: job.job_number,
      engineer: job.assigned?.name ?? "",
      customer: job.site?.client?.name ?? "",
      site: job.site?.name ?? "",
      date: job.scheduled_start,
      travel_minutes: minutes.travelMinutes,
      work_minutes: minutes.workMinutes,
      total_minutes: minutes.totalMinutes,
    };
  });

  return new NextResponse(timesheetsToCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="timesheets-export.csv"`,
    },
  });
}
