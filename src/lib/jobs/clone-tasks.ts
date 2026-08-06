import type { Database } from "@/lib/supabase/database.types";

type JobTaskInsert = Database["public"]["Tables"]["job_tasks"]["Insert"];

/**
 * Turns any ordered (position, label) source — a template's tasks when
 * applying it to a job, or a job's own tasks when duplicating the job —
 * into fresh job_tasks insert rows: re-indexed positions, always unticked.
 */
export function cloneTasksForJob(
  source: { position: number; label: string }[],
  jobId: string,
): JobTaskInsert[] {
  return source
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((t, i) => ({ job_id: jobId, position: i, label: t.label, is_done: false }));
}
