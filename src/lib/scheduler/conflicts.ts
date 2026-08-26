import { formatDurationMinutes } from "@/lib/format/duration";

export type ScheduledJob = {
  id: string;
  scheduledStart: string;
  scheduledEnd: string | null;
};

const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;
// A standard working day, per the office — same non-negotiable rule as
// max_jobs_per_day below: this only ever produces a warning, never blocks
// a schedule, since an engineer legitimately working overtime is a real
// scenario the office still needs to be able to book.
const WORKDAY_MINUTES = 8 * 60;

function toRange(job: ScheduledJob): [number, number] {
  const start = new Date(job.scheduledStart).getTime();
  const end = job.scheduledEnd ? new Date(job.scheduledEnd).getTime() : start + DEFAULT_DURATION_MS;
  return [start, end];
}

/**
 * Pure conflict-detection for the scheduler: does moving `movingJob` onto an
 * engineer's day clash with what's already there? `othersOnSameDayForEngineer`
 * must already be filtered to that engineer and that day, excluding the job
 * being moved. Returns human-readable warnings — this never blocks the move,
 * per the "conflict warnings" requirement (not "conflict prevention").
 */
export function detectConflicts(
  movingJob: ScheduledJob,
  othersOnSameDayForEngineer: ScheduledJob[],
  maxJobsPerDay: number,
): string[] {
  const warnings: string[] = [];
  const [start, end] = toRange(movingJob);

  const overlapping = othersOnSameDayForEngineer.filter((other) => {
    const [oStart, oEnd] = toRange(other);
    return start < oEnd && oStart < end;
  });
  if (overlapping.length > 0) {
    warnings.push(
      `Overlaps ${overlapping.length} other job${overlapping.length > 1 ? "s" : ""} already scheduled that day.`,
    );
  }

  const totalThatDay = othersOnSameDayForEngineer.length + 1;
  if (totalThatDay > maxJobsPerDay) {
    warnings.push(`${totalThatDay} jobs that day exceeds the daily max of ${maxJobsPerDay}.`);
  }

  // Summed job durations, not the union of their time ranges — an overlap
  // already gets its own warning above, so double-counting an overlapping
  // hour here just means both warnings surface together, which is still
  // an accurate picture of "this day has a lot on it."
  const totalMinutes = [movingJob, ...othersOnSameDayForEngineer].reduce((sum, job) => {
    const [jobStart, jobEnd] = toRange(job);
    return sum + (jobEnd - jobStart) / 60_000;
  }, 0);
  if (totalMinutes >= WORKDAY_MINUTES) {
    warnings.push(`${formatDurationMinutes(totalMinutes)} scheduled that day exceeds the 8h working day.`);
  }

  return warnings;
}
