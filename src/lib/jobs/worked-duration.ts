import type { Database } from "@/lib/supabase/database.types";

export type StatusEventForDuration = { to_status: string; occurred_at: string };

/**
 * Which job statuses a Timesheets entry makes sense for — shared between
 * /office/timesheets and its CSV export so the two queries can't drift
 * apart. Travel/work time on a job still in_progress is a moving target,
 * not something to bill against yet (see computeWorkedMinutes' own null
 * return for an open interval) — so this is every status a job reaches
 * only after the engineer has actually finished the fieldwork, regardless
 * of where it ends up in the QA pipeline afterward.
 */
export const TIMESHEET_STATUSES: Database["public"]["Enums"]["job_status"][] = [
  "submitted",
  "under_review",
  "approved",
  "closed",
  "revisit",
];

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
  return computeIntervalMinutes(events, "in_progress");
}

/**
 * Same interval-summing shape as computeWorkedMinutes, opened by
 * `travelling` instead — every `travelling -> (anything else)` span
 * (normally closed by check-in's travelling -> in_progress, but this
 * doesn't assume that specifically, same generality as the work-time
 * calculation). Shared by both via computeIntervalMinutes below rather
 * than duplicating the sort/accumulate loop for a second opening status.
 *
 * Return-leg travel (travelling home/back to the office after the job)
 * isn't tracked anywhere yet — Timesheets Phase 1 only asked for the
 * outbound leg captured here. It's a deliberate extension point, not an
 * oversight: see the Timesheets scope notes on why it's trip-level, not
 * job-level, and deferred to Phase 2.
 */
export function computeTravelMinutes(events: StatusEventForDuration[]): number | null {
  return computeIntervalMinutes(events, "travelling");
}

function computeIntervalMinutes(events: StatusEventForDuration[], openingStatus: string): number | null {
  const sorted = [...events]
    .map((e) => ({ toStatus: e.to_status, ms: new Date(e.occurred_at).getTime() }))
    .filter((e) => Number.isFinite(e.ms))
    .sort((a, b) => a.ms - b.ms);

  let openStartMs: number | null = null;
  let totalMinutes = 0;
  let hasInterval = false;

  for (const event of sorted) {
    if (event.toStatus === openingStatus) {
      openStartMs = event.ms;
    } else if (openStartMs !== null) {
      totalMinutes += (event.ms - openStartMs) / 60_000;
      hasInterval = true;
      openStartMs = null;
    }
  }

  return hasInterval ? totalMinutes : null;
}

/** Nearest 15 minutes, standard round-half-up — the unit every figure below is rounded to independently. */
export function roundToNearest15Minutes(minutes: number): number {
  return Math.round(minutes / 15) * 15;
}

export type TimesheetMinutes = { travelMinutes: number | null; workMinutes: number | null; totalMinutes: number | null };

/**
 * The three Timesheets figures for one job: travel, on-site work, and
 * total — each rounded to the nearest 15 minutes *independently*, not by
 * summing the two already-rounded figures (confirmed decision: rounding
 * travel and work separately first can shift the total by up to 15
 * minutes either way versus rounding the true total directly).
 */
export function computeTimesheetMinutes(events: StatusEventForDuration[]): TimesheetMinutes {
  const rawTravel = computeTravelMinutes(events);
  const rawWork = computeWorkedMinutes(events);
  const rawTotal = rawTravel === null && rawWork === null ? null : (rawTravel ?? 0) + (rawWork ?? 0);
  return {
    travelMinutes: rawTravel === null ? null : roundToNearest15Minutes(rawTravel),
    workMinutes: rawWork === null ? null : roundToNearest15Minutes(rawWork),
    totalMinutes: rawTotal === null ? null : roundToNearest15Minutes(rawTotal),
  };
}
