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

/** Splits [startMs, endMs) into per-UTC-day minute contributions, at UTC midnight boundaries — same "day" convention as the scheduler board's day keys (see jobDayKeys), so a shift that runs past midnight lands on both days instead of being wholly attributed to whichever one it started on. */
function splitMinutesByUtcDay(startMs: number, endMs: number): Map<string, number> {
  const byDay = new Map<string, number>();
  let cursor = startMs;
  while (cursor < endMs) {
    const dayKey = new Date(cursor).toISOString().slice(0, 10);
    const nextMidnight = new Date(cursor);
    nextMidnight.setUTCHours(24, 0, 0, 0);
    const segmentEnd = Math.min(endMs, nextMidnight.getTime());
    byDay.set(dayKey, (byDay.get(dayKey) ?? 0) + (segmentEnd - cursor) / 60_000);
    cursor = segmentEnd;
  }
  return byDay;
}

function computeDailyIntervalMinutes(events: StatusEventForDuration[], openingStatus: string): Map<string, number> {
  const sorted = [...events]
    .map((e) => ({ toStatus: e.to_status, ms: new Date(e.occurred_at).getTime() }))
    .filter((e) => Number.isFinite(e.ms))
    .sort((a, b) => a.ms - b.ms);

  const byDay = new Map<string, number>();
  let openStartMs: number | null = null;
  for (const event of sorted) {
    if (event.toStatus === openingStatus) {
      openStartMs = event.ms;
    } else if (openStartMs !== null) {
      for (const [day, minutes] of splitMinutesByUtcDay(openStartMs, event.ms)) {
        byDay.set(day, (byDay.get(day) ?? 0) + minutes);
      }
      openStartMs = null;
    }
  }
  return byDay;
}

export type DailyMinutes = { travelMinutes: number; workMinutes: number };

/**
 * Raw (unrounded) per-UTC-day travel/work minutes for one job — the
 * per-day counterpart to computeTimesheetMinutes above. Deliberately
 * unrounded: the Timesheets week grid sums several jobs' time onto the
 * same engineer/day before rounding once, and rounding here first would
 * compound each job's independent rounding error into the daily total.
 * A day the job never touched is simply absent from the map.
 */
export function computeDailyMinutes(events: StatusEventForDuration[]): Map<string, DailyMinutes> {
  const travelByDay = computeDailyIntervalMinutes(events, "travelling");
  const workByDay = computeDailyIntervalMinutes(events, "in_progress");
  const days = new Set([...travelByDay.keys(), ...workByDay.keys()]);
  const result = new Map<string, DailyMinutes>();
  for (const day of days) {
    result.set(day, { travelMinutes: travelByDay.get(day) ?? 0, workMinutes: workByDay.get(day) ?? 0 });
  }
  return result;
}

export type JobEventsForDuration = { assignedTo: string | null; events: StatusEventForDuration[] };

/**
 * The Timesheets week grid's own aggregation step: rounded travel/work/
 * total minutes per engineer per UTC day, summed across every job passed
 * in. Sums each job's raw daily contribution first and rounds once at
 * the end, per engineer per day — not by adding already-rounded per-job
 * figures, which would compound rounding error the same way
 * computeTimesheetMinutes' own independent-rounding note warns against
 * at the single-job level. Jobs with no assignee are skipped; a job that
 * never touched a given day simply doesn't contribute to it.
 */
export function computeEngineerDayMinutes(jobs: JobEventsForDuration[]): Map<string, Map<string, TimesheetMinutes>> {
  const rawByEngineer = new Map<string, Map<string, DailyMinutes>>();
  for (const job of jobs) {
    if (!job.assignedTo) continue;
    const dayMap = rawByEngineer.get(job.assignedTo) ?? new Map<string, DailyMinutes>();
    rawByEngineer.set(job.assignedTo, dayMap);
    for (const [day, { travelMinutes, workMinutes }] of computeDailyMinutes(job.events)) {
      const existing = dayMap.get(day) ?? { travelMinutes: 0, workMinutes: 0 };
      dayMap.set(day, { travelMinutes: existing.travelMinutes + travelMinutes, workMinutes: existing.workMinutes + workMinutes });
    }
  }

  const result = new Map<string, Map<string, TimesheetMinutes>>();
  for (const [engineerId, dayMap] of rawByEngineer) {
    const rounded = new Map<string, TimesheetMinutes>();
    for (const [day, { travelMinutes, workMinutes }] of dayMap) {
      rounded.set(day, {
        travelMinutes: roundToNearest15Minutes(travelMinutes),
        workMinutes: roundToNearest15Minutes(workMinutes),
        totalMinutes: roundToNearest15Minutes(travelMinutes + workMinutes),
      });
    }
    result.set(engineerId, rounded);
  }
  return result;
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
