import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { humanize } from "@/lib/format/text";
import { JOB_TYPE_LABELS } from "@/lib/forms/job-form";
import { QaRow } from "./qa-row";

export default async function QaQueuePage() {
  const supabase = await createClient();
  const { data: jobs, error } = await supabase
    .from("jobs")
    .select(
      "id, job_number, job_type, status, site:sites(name, client:clients(name)), project:projects(name), assigned:users!jobs_assigned_to_fkey(name), install_forms(issues_found, player_boot_test, content_displaying)",
    )
    .in("status", ["submitted", "under_review"])
    .order("created_at", { ascending: true });

  if (error) return <p className="text-destructive">Failed to load job review queue: {error.message}</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Job Review</h1>
        <span className="text-muted-foreground text-sm">{jobs?.length ?? 0} awaiting review</span>
      </div>

      {(jobs ?? []).length === 0 && (
        <p className="text-muted-foreground text-sm">Nothing to review right now.</p>
      )}

      {(jobs ?? []).length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job #</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(jobs ?? []).map((job) => {
              const form = (job.install_forms as { issues_found: boolean | null; player_boot_test: string | null; content_displaying: string | null }[] | null)?.[0];
              const hasFailure = form && (form.player_boot_test === "fail" || form.content_displaying === "fail" || form.issues_found);
              return (
                <TableRow key={job.id} data-testid="qa-row">
                  <TableCell>
                    <Link href={`/office/jobs/${job.id}`} className="font-medium underline-offset-2 hover:underline">
                      {job.job_number}
                    </Link>
                  </TableCell>
                  <TableCell>{job.site?.client?.name ?? "—"}</TableCell>
                  <TableCell>{job.site?.name ?? "—"}</TableCell>
                  <TableCell>{job.project?.name ?? "—"}</TableCell>
                  <TableCell>{JOB_TYPE_LABELS[job.job_type as keyof typeof JOB_TYPE_LABELS] ?? humanize(job.job_type)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{humanize(job.status)}</Badge>
                      {hasFailure && <Badge variant="destructive">Flagged</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>{job.assigned?.name ?? "Unassigned"}</TableCell>
                  <TableCell className="whitespace-normal">
                    <QaRow jobId={job.id} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
