export type WeekJobCounts = { completedCount: number; scheduledCount: number };

const COMPLETED_STATUSES = new Set(["closed", "approved"]);
const SCHEDULED_STATUSES = new Set([
  "scheduled",
  "dispatched",
  "accepted",
  "travelling",
  "on_site",
  "in_progress",
  "submitted",
  "under_review",
]);

/**
 * Pure tally over a project's jobs for one week window — the caller does
 * the date filtering (a plain `.gte()/.lt()` query), this just categorizes
 * by status so the categorization logic itself is unit-testable without a
 * database.
 */
export function countWeekJobs(jobStatuses: string[]): WeekJobCounts {
  let completedCount = 0;
  let scheduledCount = 0;
  for (const status of jobStatuses) {
    if (COMPLETED_STATUSES.has(status)) completedCount++;
    else if (SCHEDULED_STATUSES.has(status)) scheduledCount++;
  }
  return { completedCount, scheduledCount };
}
