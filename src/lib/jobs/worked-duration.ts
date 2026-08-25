export type StatusEventForDuration = { to_status: string; occurred_at: string };

/**
 * Total minutes actually spent "in progress" on a job — summed across every
 * `in_progress -> (anything else)` interval in the job's own status_events
 * history, not a single `actual_end - actual_start` subtraction. That
 * subtraction is exactly right for a job worked in one sitting, but a job
 * that spans multiple days (checked in Monday, paused overnight via
 * in_progress -> on_hold, resumed Tuesday via on_hold -> in_progress, and so
 * on — see DECISIONS.md's pause/resume addendum) would otherwise count the
 * whole overnight gap as time worked. A job that's never been paused
 * reduces to exactly one interval — the same number `actual_end -
 * actual_start` already gave — so this is a strict correction, not a
 * behaviour change, for every job that doesn't use pause.
 *
 * Ignores every event that isn't a transition into or out of in_progress
 * (e.g. travelling -> on_site is irrelevant here). Returns null when
 * there's no closed interval to report at all — a job still in_progress
 * with no closing event yet (not yet paused or submitted) has no "worked
 * so far" figure to show, same "nothing to show" convention as
 * formatDurationBetween/formatDurationMinutes.
 */
export function computeWorkedMinutes(events: StatusEventForDuration[]): number | null {
  const sorted = [...events]
    .map((e) => ({ toStatus: e.to_status, ms: new Date(e.occurred_at).getTime() }))
    .filter((e) => Number.isFinite(e.ms))
    .sort((a, b) => a.ms - b.ms);

  let openStartMs: number | null = null;
  let totalMinutes = 0;
  let hasInterval = false;

  for (const event of sorted) {
    if (event.toStatus === "in_progress") {
      openStartMs = event.ms;
    } else if (openStartMs !== null) {
      totalMinutes += (event.ms - openStartMs) / 60_000;
      hasInterval = true;
      openStartMs = null;
    }
  }

  return hasInterval ? totalMinutes : null;
}
