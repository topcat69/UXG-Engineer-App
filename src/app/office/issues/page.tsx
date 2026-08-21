import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { humanize } from "@/lib/format/text";
import { groupIssuesByJob } from "@/lib/issues/group-by-job";

/**
 * A standalone, browsable list of every open issue — previously the only
 * way to see issues in the office UI at all was the dashboard's "open
 * issues by age" chart (aggregate counts only, no way to actually read
 * one). "Open" here means the issue's own job hasn't closed yet, not the
 * issue's own `status` column: nothing in this app currently ever sets an
 * issue's status away from "open" (there's no resolve action), so keying
 * visibility off the job being closed — which the QA-approve flow already
 * does — is what the app's actual data supports today, not an
 * issues.status this app doesn't otherwise use.
 *
 * Grouped one card per job (see groupIssuesByJob), not one per issue row —
 * a single submission can auto-raise several issues at once (a failed
 * boot test, content not displaying, and "revisit required" all firing
 * independently), which read as that many separate open problems when
 * it's really one job needing attention, whether it ran for one day or
 * several.
 */
export default async function IssuesPage() {
  const supabase = await createClient();
  const { data: issues, error } = await supabase
    .from("issues")
    .select(
      "*, job:jobs!issues_job_id_fkey(id, job_number, status), site:sites(name), raised_by_user:users(name), revisit_job:jobs!issues_revisit_job_id_fkey(id, job_number)",
    )
    .order("created_at", { ascending: true });

  if (error) return <p className="text-destructive">Failed to load issues: {error.message}</p>;

  const openIssues = (issues ?? []).filter((issue) => issue.job && issue.job.status !== "closed");
  const groups = groupIssuesByJob(openIssues);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Issues</h1>
        <span className="text-muted-foreground text-sm">
          {groups.length} job{groups.length === 1 ? "" : "s"} with open issues
        </span>
      </div>

      {groups.length === 0 && (
        <p className="text-muted-foreground text-sm">No open issues — every flagged job has been closed.</p>
      )}

      <div className="flex flex-col gap-3">
        {groups.map((group) => (
          <div key={group.jobId} data-testid="issue-job-group" className="flex flex-col gap-3 rounded-md border p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Link href={`/office/jobs/${group.jobId}`} className="font-medium underline-offset-2 hover:underline">
                {group.jobNumber}
              </Link>
              <span className="text-muted-foreground">
                · {humanize(group.jobStatus)}
                {group.siteName && ` · ${group.siteName}`}
              </span>
              {group.revisitJob && (
                <Link href={`/office/jobs/${group.revisitJob.id}`} className="text-muted-foreground underline">
                  Revisit: {group.revisitJob.job_number}
                </Link>
              )}
            </div>
            <ul className="flex flex-col gap-2">
              {group.issues.map((issue, i) => (
                <li key={issue.id} className={i > 0 ? "border-t pt-2" : ""}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={issue.severity === "critical" || issue.severity === "high" ? "destructive" : "secondary"}>
                      {humanize(issue.severity)}
                    </Badge>
                    {issue.blocks_completion && <Badge variant="outline">Blocks completion</Badge>}
                    {issue.category && <Badge variant="outline">{humanize(issue.category)}</Badge>}
                    <span className="text-muted-foreground text-sm">
                      {issue.created_at ? new Date(issue.created_at).toLocaleDateString() : "unknown date"}
                      {issue.raised_by_user?.name ? ` · ${issue.raised_by_user.name}` : ""}
                    </span>
                  </div>
                  <p className="text-sm">{issue.description}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
