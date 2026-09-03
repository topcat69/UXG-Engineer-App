import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { applyJobListFilters, parseJobListFilters } from "@/lib/jobs/list-query";
import { jobsToCsv, type JobExportRow } from "@/lib/csv/export";

// Comfortably above anything this app's stated 500-job/8-person scale
// needs (see PROMPT.md's Phase 7 load-test target) without being
// unbounded — a filtered export bigger than this almost certainly means
// the filter should be narrower, not that the cap should be higher.
const EXPORT_ROW_LIMIT = 5000;

/**
 * Same filters as the jobs list page (status, project, assigned engineer,
 * search, and the dashboard's `ids`/`active`/`is_revisit` drill-through
 * params), via the shared parseJobListFilters/applyJobListFilters — so
 * "export this filtered list" always matches what's on screen, never a
 * second, slightly different query someone forgot to keep in sync.
 * Authenticated the normal RLS way (the request-scoped Supabase client),
 * not a shared secret — this is a browser-initiated download from an
 * already-signed-in office user, not a server-to-server call.
 */
export async function GET(request: Request) {
  // /api is public at the proxy layer (see proxy.ts's PUBLIC_PATHS —
  // webhook/cron/ICS routes there authenticate their own way), so this
  // route has to check the session itself rather than relying on a
  // redirect that never happens for it. Without this, an unauthenticated
  // request falls through to a raw Postgres "permission denied" error
  // instead of a clean 401 — anon has no table grants at all by design
  // (see grants.sql), which is correct defense in depth, but isn't a
  // response this route should hand back as-is.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const searchParams = Object.fromEntries(new URL(request.url).searchParams);
  const filters = parseJobListFilters(searchParams);

  const supabase = await createClient();
  const { data: jobs, error } = await applyJobListFilters(
    supabase
      .from("jobs")
      .select(
        "job_number, status, job_type, priority, scheduled_start, site:sites(name, client:clients(name)), project:projects(name), assigned:users!jobs_assigned_to_fkey(name)",
      )
      .order("created_at", { ascending: false })
      .limit(EXPORT_ROW_LIMIT),
    filters,
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows: JobExportRow[] = (jobs ?? []).map((job) => ({
    job_number: job.job_number,
    status: job.status,
    job_type: job.job_type,
    priority: job.priority,
    customer: job.site?.client?.name ?? "",
    site: job.site?.name ?? "",
    project: job.project?.name ?? "",
    assigned_to: job.assigned?.name ?? "",
    scheduled_start: job.scheduled_start,
  }));

  return new NextResponse(jobsToCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="jobs-export.csv"`,
    },
  });
}
