import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "./dashboard-client";

/**
 * All non-draft jobs, no date window — at this app's stated scale (eight
 * people, PROMPT.md's own framing) that's a small enough working set to
 * just fetch outright, and it avoids inventing a date-range picker the
 * spec never asked for. Revisit this the moment the dataset actually grows
 * past what a single query comfortably returns (Phase 7's territory).
 */
export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: jobs }, { data: issues }, { data: engineers }, { data: mapJobs }, { data: projects }] =
    await Promise.all([
      supabase
        .from("jobs")
        .select("id, status, parent_job_id, scheduled_start, actual_start, actual_end, assigned_to, status_events(to_status, occurred_at)")
        .neq("status", "draft"),
      supabase.from("issues").select("job_id, category, status, revisit_job_id, created_at"),
      supabase.from("users").select("id, name").eq("role", "engineer").eq("active", true).order("name"),
      supabase
        .from("jobs")
        .select(
          "id, job_number, status, parent_job_id, project_id, site:sites(name, latitude, longitude), assigned:users!jobs_assigned_to_fkey(name)",
        )
        .neq("status", "draft"),
      supabase.from("projects").select("id, name").order("name"),
    ]);

  return (
    <DashboardClient
      initialJobs={jobs ?? []}
      initialIssues={issues ?? []}
      engineers={engineers ?? []}
      initialMapJobs={mapJobs ?? []}
      projects={projects ?? []}
    />
  );
}
