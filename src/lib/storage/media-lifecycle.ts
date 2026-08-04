/**
 * "Storage lifecycle rules" per PROMPT.md's Phase 7, implemented as an
 * application-level scheduled cleanup rather than a bucket-config policy —
 * local (and self-hosted) Supabase Storage doesn't expose native S3
 * lifecycle transitions/expirations through its API, so there's no knob
 * to turn there. This is the practical equivalent for a small internal
 * tool: media belonging to a job that never went anywhere (still `draft`,
 * or `cancelled`) and hasn't been touched in a long time is safe to
 * reclaim. See DECISIONS.md's Phase 7 section for the full rationale.
 */
export const MEDIA_RETENTION_DAYS = 90;

const ELIGIBLE_STATUSES = new Set(["draft", "cancelled"]);

export type LifecycleJob = { id: string; status: string; updated_at: string | null };

/** A job with no `updated_at` is never eligible — that's missing data, not an old job, and deleting on missing data would be a silent-failure trap. */
export function selectLifecycleEligibleJobIds(
  jobs: LifecycleJob[],
  nowIso: string,
  retentionDays: number = MEDIA_RETENTION_DAYS,
): string[] {
  const now = new Date(nowIso).getTime();
  const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
  return jobs
    .filter((job) => {
      if (!ELIGIBLE_STATUSES.has(job.status) || !job.updated_at) return false;
      return now - new Date(job.updated_at).getTime() >= retentionMs;
    })
    .map((job) => job.id);
}
