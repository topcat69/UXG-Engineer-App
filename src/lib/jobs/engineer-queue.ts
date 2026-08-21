// "My Jobs" only shows a job once it's actually been scheduled and until
// it's checked out — "draft" is excluded because being assigned to a job
// isn't the same as it being scheduled to you yet (draft jobs have no
// scheduled_start, and this app auto-transitions status away from draft
// the moment one gets set — see assignAndScheduleJob/rescheduleJob/
// bulkScheduleJobs), and once a job is checked out (status "submitted"
// and every status after — under_review/approved/closed) or cancelled,
// it's no longer something an engineer needs to act on either. Deliberately
// not reusing dashboard/metrics.ts's ACTIVE_STATUSES here: that set
// excludes "on_hold", which should still show up in an engineer's queue
// (it's a paused job they're still assigned to, not a finished one).
const QUEUE_EXIT_STATUSES = new Set(["draft", "submitted", "under_review", "approved", "closed", "cancelled"]);

export function isInEngineerQueue(status: string): boolean {
  return !QUEUE_EXIT_STATUSES.has(status);
}
