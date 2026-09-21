/**
 * Pure classification for one SLA job — the SLA compliance report's own
 * "was this met" step, kept separate from the query/aggregation code so
 * it's unit-testable without a live DB (same split as worked-duration.ts).
 *
 * The clock, per the Report Generator Blueprint's resolved scoping:
 * start is jobs.actual_start (the engineer physically starting the job,
 * not creation/scheduling — SLA jobs can be logged weeks ahead), end is
 * job_details.submitted_at (completion from the engineer's own point of
 * view; manager approval is a separate, later event tracked as its own
 * turnaround metric, not folded into this clock). Pauses count against
 * the clock by default — this is wall-clock elapsed time between the two
 * timestamps, not the pause-aware worked-duration.ts computation.
 */
export type SlaJobOutcome = "met" | "breached" | "open";

export type SlaJobInput = {
  actualStart: string | null;
  submittedAt: string | null;
  targetHours: number | null;
};

export type SlaJobResult = {
  outcome: SlaJobOutcome;
  /** Elapsed hours from actualStart to submittedAt (or to `now` if still in flight). Null when the clock hasn't started yet (no actualStart). */
  durationHours: number | null;
};

/**
 * "open" covers three different reasons a job isn't classified met/breached
 * yet: not started, started but not submitted, or submitted with no target
 * on file for that client to measure against — the report surfaces all
 * three as "in flight / unclassified" rather than distinguishing them, per
 * the blueprint's "in-flight jobs included" headline-rate note.
 */
export function classifySlaJob(job: SlaJobInput, now: Date): SlaJobResult {
  if (!job.actualStart) return { outcome: "open", durationHours: null };

  const startMs = new Date(job.actualStart).getTime();
  const endMs = job.submittedAt ? new Date(job.submittedAt).getTime() : now.getTime();
  const durationHours = (endMs - startMs) / 3_600_000;

  if (!job.submittedAt || job.targetHours == null) return { outcome: "open", durationHours };
  return { outcome: durationHours <= job.targetHours ? "met" : "breached", durationHours };
}
