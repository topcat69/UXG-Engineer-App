export type IssueForGrouping = {
  id: string;
  severity: string;
  blocks_completion: boolean | null;
  category: string | null;
  created_at: string | null;
  description: string;
  raised_by_user: { name: string } | null;
  job: { id: string; job_number: string; status: string } | null;
  site: { name: string } | null;
  revisit_job: { id: string; job_number: string } | null;
};

export type JobIssueGroup = {
  jobId: string;
  jobNumber: string;
  jobStatus: string;
  siteName: string | null;
  revisitJob: { id: string; job_number: string } | null;
  issues: IssueForGrouping[];
  worstSeverityRank: number;
};

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/**
 * Collapses one row per issue into one row per job. A single field
 * submission can auto-raise several issues at once (a failed boot test,
 * content not displaying, and "revisit required" all fire independently —
 * see detectAutoIssues in lib/forms/job-form.ts), which read as that many
 * separate open problems on the Issues page when really it's one job that
 * needs attention. Each issue keeps its own severity/date/raiser inside
 * the group; the group itself sorts by its most severe issue, same
 * ordering the page used before this collapsed anything.
 */
export function groupIssuesByJob(issues: IssueForGrouping[]): JobIssueGroup[] {
  const groups = new Map<string, JobIssueGroup>();

  for (const issue of issues) {
    if (!issue.job) continue;
    const rank = SEVERITY_ORDER[issue.severity] ?? 9;
    const existing = groups.get(issue.job.id);
    if (existing) {
      existing.issues.push(issue);
      existing.worstSeverityRank = Math.min(existing.worstSeverityRank, rank);
      if (issue.revisit_job && !existing.revisitJob) existing.revisitJob = issue.revisit_job;
    } else {
      groups.set(issue.job.id, {
        jobId: issue.job.id,
        jobNumber: issue.job.job_number,
        jobStatus: issue.job.status,
        siteName: issue.site?.name ?? null,
        revisitJob: issue.revisit_job,
        issues: [issue],
        worstSeverityRank: rank,
      });
    }
  }

  return Array.from(groups.values()).sort((a, b) => a.worstSeverityRank - b.worstSeverityRank);
}
