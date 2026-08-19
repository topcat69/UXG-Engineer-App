/**
 * Mirrors the AppSheet build's job-number scheme exactly (see the AppSheet
 * build guide, section 5): `UXG-{year}-{4-digit sequence}`. Not
 * concurrency-safe — two office users generating jobs in the same instant
 * could collide — which is an accepted tradeoff at this scale (same
 * caveat the AppSheet guide states), not an oversight.
 *
 * `currentMax` must be the highest sequence number actually in use for
 * `year` (see parseMaxSequence/maxJobSequenceForYear in next-job-number.ts)
 * — NOT a row count. A row count drifts from the real max the moment any
 * job is ever deleted, or once a prior year's jobs exist in the same
 * table, and either one hands out a sequence number that's already taken,
 * tripping the jobs_job_number_key unique constraint on insert.
 */
export function nextJobNumber(currentMax: number, year: number, offset: number): string {
  return `UXG-${year}-${String(currentMax + offset).padStart(4, "0")}`;
}

/**
 * Pure part of maxJobSequenceForYear (next-job-number.ts) — parses the
 * numeric suffix off each `UXG-{year}-NNNN` job number and returns the
 * highest one found, ignoring anything that doesn't parse (defensive
 * against the AppSheet-migrated data's job numbers, which don't
 * necessarily follow this exact scheme).
 */
export function parseMaxSequence(jobNumbers: string[], year: number): number {
  const prefix = `UXG-${year}-`;
  return jobNumbers.reduce((max, jobNumber) => {
    if (!jobNumber.startsWith(prefix)) return max;
    const n = Number(jobNumber.slice(prefix.length));
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
}
