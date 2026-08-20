import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { humanize } from "@/lib/format/text";

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

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

  const openIssues = (issues ?? [])
    .filter((issue) => issue.job && issue.job.status !== "closed")
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Issues</h1>
        <span className="text-muted-foreground text-sm">{openIssues.length} open</span>
      </div>

      {openIssues.length === 0 && (
        <p className="text-muted-foreground text-sm">No open issues — every flagged job has been closed.</p>
      )}

      <div className="flex flex-col gap-3">
        {openIssues.map((issue) => (
          <div key={issue.id} data-testid="issue-row" className="flex flex-col gap-2 rounded-md border p-4">
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
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {issue.job && (
                <Link href={`/office/jobs/${issue.job.id}`} className="font-medium underline-offset-2 hover:underline">
                  {issue.job.job_number}
                </Link>
              )}
              <span className="text-muted-foreground">
                {issue.job && `· ${humanize(issue.job.status)}`}
                {issue.site?.name && ` · ${issue.site.name}`}
              </span>
              {issue.revisit_job && (
                <Link href={`/office/jobs/${issue.revisit_job.id}`} className="text-muted-foreground underline">
                  Revisit: {issue.revisit_job.job_number}
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
