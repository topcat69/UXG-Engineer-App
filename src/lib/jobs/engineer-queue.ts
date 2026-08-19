// Once a job is checked out (status "submitted" and every status after —
// under_review/approved/closed) or cancelled, it's no longer something an
// engineer needs to act on, so it drops out of "My Jobs". Deliberately not
// reusing dashboard/metrics.ts's ACTIVE_STATUSES here: that set excludes
// "on_hold", which should still show up in an engineer's queue (it's a
// paused job they're still assigned to, not a finished one).
const QUEUE_EXIT_STATUSES = new Set(["submitted", "under_review", "approved", "closed", "cancelled"]);

export function isInEngineerQueue(status: string): boolean {
  return !QUEUE_EXIT_STATUSES.has(status);
}
