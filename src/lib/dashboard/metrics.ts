// Pure metric calculations over already-fetched rows — no Supabase calls
// here, so every number the dashboard shows is independently testable
// without a database. The page/client component does the fetching and
// re-fetching (on mount and on every Realtime event); this file only does
// arithmetic.

export type DashboardJob = {
  id: string;
  status: string;
  parent_job_id: string | null;
  scheduled_start: string | null;
  actual_start: string | null;
  actual_end: string | null;
  assigned_to: string | null;
};

export type DashboardIssue = {
  job_id: string | null;
  category: string | null;
  status: string | null;
  revisit_job_id: string | null;
  created_at: string | null;
};

export type Engineer = { id: string; name: string };

/** Exported so the jobs list's `?active=true` drill-through filter counts exactly the same jobs the dashboard does — one definition, not two that could drift. */
export const ACTIVE_STATUSES = new Set([
  "scheduled",
  "dispatched",
  "accepted",
  "travelling",
  "on_site",
  "in_progress",
]);

/**
 * "First-time fix" = an original job (not itself a revisit) that reached
 * `closed` without ever spawning a revisit of its own. Deliberately scoped
 * to original jobs only: a revisit closing doesn't retroactively change
 * whether the *original* visit fixed the problem on the first attempt,
 * which is the question this rate answers. Jobs that are still mid-flight
 * (not yet closed, and no revisit spawned yet) count toward neither side —
 * the rate is about outcomes, not works-in-progress.
 */
export function computeFirstTimeFixRate(jobs: DashboardJob[]): {
  rate: number | null;
  firstTimeFixCount: number;
  totalClosedOriginals: number;
} {
  const revisitedParentIds = new Set(jobs.filter((j) => j.parent_job_id).map((j) => j.parent_job_id));
  const closedOriginals = jobs.filter((j) => j.status === "closed" && !j.parent_job_id);
  const firstTimeFixCount = closedOriginals.filter((j) => !revisitedParentIds.has(j.id)).length;
  const totalClosedOriginals = closedOriginals.length;
  return {
    rate: totalClosedOriginals === 0 ? null : firstTimeFixCount / totalClosedOriginals,
    firstTimeFixCount,
    totalClosedOriginals,
  };
}

/**
 * "Completed" and "scheduled" are deliberately mutually exclusive — a
 * closed job doesn't also count as "scheduled" just because it still has
 * a scheduled_start on file, which an earlier version of this function
 * got wrong (a job moving to closed left the scheduled count unchanged,
 * caught by the Phase 6 E2E test expecting the two numbers to move in
 * opposite directions).
 */
export function computeCompletedVsScheduled(jobs: DashboardJob[]): { completed: number; scheduled: number } {
  return {
    completed: jobs.filter((j) => j.status === "closed").length,
    scheduled: jobs.filter(
      (j) => j.scheduled_start !== null && j.status !== "draft" && j.status !== "cancelled" && j.status !== "closed",
    ).length,
  };
}

/** In minutes. Null when no job has both actual_start and actual_end recorded. */
export function computeAverageTimeOnSiteMinutes(jobs: DashboardJob[]): number | null {
  const durations = jobs
    .filter((j) => j.actual_start && j.actual_end)
    .map((j) => (new Date(j.actual_end!).getTime() - new Date(j.actual_start!).getTime()) / 60_000)
    .filter((minutes) => minutes >= 0);
  if (durations.length === 0) return null;
  return durations.reduce((sum, m) => sum + m, 0) / durations.length;
}

export type RevisitCause = { category: string; count: number; rate: number };

/** Only issues that actually caused a revisit (revisit_job_id set) count — a raised-but-not-blocking issue isn't a "cause" of anything. */
export function computeRevisitRateByCause(issues: DashboardIssue[]): RevisitCause[] {
  const causeIssues = issues.filter((i) => i.revisit_job_id !== null);
  const total = causeIssues.length;
  if (total === 0) return [];

  const counts = new Map<string, number>();
  for (const issue of causeIssues) {
    const category = issue.category ?? "uncategorised";
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([category, count]) => ({ category, count, rate: count / total }))
    .sort((a, b) => b.count - a.count);
}

export type IssueAgeBucket = { label: string; count: number };
const AGE_BUCKETS = [
  { label: "0–7 days", maxDays: 7 },
  { label: "8–14 days", maxDays: 14 },
  { label: "15–30 days", maxDays: 30 },
  { label: "30+ days", maxDays: Infinity },
];

export function computeOpenIssuesByAge(issues: DashboardIssue[], nowIso: string): IssueAgeBucket[] {
  const now = new Date(nowIso).getTime();
  const buckets = AGE_BUCKETS.map((b) => ({ label: b.label, count: 0 }));

  for (const issue of issues) {
    if (issue.status !== "open" || !issue.created_at) continue;
    const ageDays = (now - new Date(issue.created_at).getTime()) / (1000 * 60 * 60 * 24);
    const bucketIndex = AGE_BUCKETS.findIndex((b) => ageDays <= b.maxDays);
    buckets[bucketIndex === -1 ? buckets.length - 1 : bucketIndex].count++;
  }
  return buckets;
}

export type EngineerWorkload = { engineerId: string; engineerName: string; activeCount: number };

/** "Workload" = currently active jobs (assigned, not yet closed/cancelled) — not a lifetime total, which wouldn't say anything about who's overloaded right now. */
export function computeEngineerWorkload(jobs: DashboardJob[], engineers: Engineer[]): EngineerWorkload[] {
  return engineers
    .map((engineer) => ({
      engineerId: engineer.id,
      engineerName: engineer.name,
      activeCount: jobs.filter((j) => j.assigned_to === engineer.id && ACTIVE_STATUSES.has(j.status)).length,
    }))
    .sort((a, b) => b.activeCount - a.activeCount);
}
