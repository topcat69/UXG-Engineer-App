import { createClient } from "@/lib/supabase/server";
import { JobsTable, type JobRow } from "../jobs/jobs-table";
import { CreateSlaForm } from "./create-sla-form";

const PAGE_SIZE = 50;

/**
 * SLA jobs are `jobs` rows (job_type "sla") like any other — this page is
 * just the general Jobs list/table pre-filtered to that type, plus the
 * dedicated Customer -> Site -> Fixture Type creation flow (no Project,
 * no manual job-type picker) instead of the generic New Job form. Reuses
 * JobsTable as-is: it already renders a blank "—" for a null project, and
 * bulk assign/schedule work identically for an SLA job as for any other.
 */
export default async function SlaJobsPage() {
  const supabase = await createClient();

  const [{ data: jobs, count, error }, { data: clients }, { data: sites }, { data: fixtureTypes }, { data: engineers }] =
    await Promise.all([
      supabase
        .from("jobs")
        .select(
          "id, job_number, job_type, status, priority, scheduled_start, assigned_to, site:sites(name, client:clients(name)), project:projects(name), assigned:users!jobs_assigned_to_fkey(name)",
          { count: "exact" },
        )
        .eq("job_type", "sla")
        .order("created_at", { ascending: false })
        .range(0, PAGE_SIZE - 1),
      supabase.from("clients").select("id, name").order("name"),
      supabase.from("sites").select("id, name, client_id").order("name"),
      supabase.from("client_sla_fixture_types").select("id, name, client_id").order("name"),
      supabase.from("users").select("id, name").in("role", ["engineer", "manager"]).eq("active", true).order("name"),
    ]);

  if (error) {
    return <p className="text-destructive">Failed to load SLA jobs: {error.message}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">SLA</h1>
          <p className="text-muted-foreground text-sm">
            Reactive callouts against a customer&apos;s equipment — one SLA per customer, no project attached.
          </p>
        </div>
        <span className="text-muted-foreground text-sm">{count ?? 0} total</span>
      </div>

      <CreateSlaForm clients={clients ?? []} sites={sites ?? []} fixtureTypes={fixtureTypes ?? []} />

      <JobsTable jobs={(jobs ?? []) as unknown as JobRow[]} engineers={engineers ?? []} />
    </div>
  );
}
