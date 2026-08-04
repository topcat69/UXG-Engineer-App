import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { QaRow } from "./qa-row";

export default async function QaQueuePage() {
  const supabase = await createClient();
  const { data: jobs, error } = await supabase
    .from("jobs")
    .select(
      "id, job_number, job_type, status, site:sites(name), project:projects(name), assigned:users!jobs_assigned_to_fkey(name), install_forms(issues_found, player_boot_test, content_displaying)",
    )
    .in("status", ["submitted", "under_review"])
    .order("created_at", { ascending: true });

  if (error) return <p className="text-destructive">Failed to load QA queue: {error.message}</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">QA Queue</h1>
        <span className="text-muted-foreground text-sm">{jobs?.length ?? 0} awaiting review</span>
      </div>

      {(jobs ?? []).length === 0 && (
        <p className="text-muted-foreground text-sm">Nothing to review right now.</p>
      )}

      <div className="flex flex-col gap-3">
        {(jobs ?? []).map((job) => {
          const form = (job.install_forms as { issues_found: boolean | null; player_boot_test: string | null; content_displaying: string | null }[] | null)?.[0];
          const hasFailure = form && (form.player_boot_test === "fail" || form.content_displaying === "fail" || form.issues_found);
          return (
            <div key={job.id} data-testid="qa-row" className="flex flex-col gap-2 rounded-md border p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Link href={`/office/jobs/${job.id}`} className="font-medium underline-offset-2 hover:underline">
                    {job.job_number}
                  </Link>
                  <Badge variant="secondary">{job.status}</Badge>
                  {hasFailure && <Badge variant="destructive">Flagged</Badge>}
                </div>
                <span className="text-muted-foreground text-sm">
                  {job.site?.name} · {job.project?.name} · {job.assigned?.name ?? "Unassigned"}
                </span>
              </div>
              <QaRow jobId={job.id} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
