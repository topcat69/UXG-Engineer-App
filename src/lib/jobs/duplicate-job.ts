import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { nextJobNumber } from "./job-number";
import { cloneTasksForJob } from "./clone-tasks";

type AnySupabaseClient = SupabaseClient<Database>;

export type SourceJob = {
  id: string;
  job_number: string;
  project_id: string | null;
  site_id: string;
  job_type: string;
  description: string | null;
};

export type DuplicateJobResult = { newJobId: string } | { error: string };

/**
 * Clones a job into a fresh draft — same site/project/type/description, its
 * own task checklist copied over (unticked), no schedule or assignment.
 * Deliberately does NOT set parent_job_id: that column means "revisit"
 * (see create-revisit.ts) and feeds the dashboard's revisit-rate metric —
 * a duplicate is a new, unrelated job, not rework, so it stays unlinked.
 * The link to its source is recorded only in the status_events reason, same
 * as a revisit's provenance is.
 */
export async function duplicateJob(supabase: AnySupabaseClient, source: SourceJob, userId: string | null): Promise<DuplicateJobResult> {
  const { count } = await supabase.from("jobs").select("id", { count: "exact", head: true });
  const { data: duplicate, error } = await supabase
    .from("jobs")
    .insert({
      job_number: nextJobNumber(count ?? 0, new Date().getFullYear(), 1),
      project_id: source.project_id,
      site_id: source.site_id,
      job_type: source.job_type,
      description: source.description,
      status: "draft",
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const { data: sourceTasks } = await supabase
    .from("job_tasks")
    .select("position, label")
    .eq("job_id", source.id)
    .order("position");
  if (sourceTasks && sourceTasks.length > 0) {
    const { error: tasksError } = await supabase.from("job_tasks").insert(cloneTasksForJob(sourceTasks, duplicate.id));
    if (tasksError) return { error: tasksError.message };
  }

  await supabase.from("status_events").insert({
    job_id: duplicate.id,
    from_status: null,
    to_status: "draft",
    user_id: userId,
    reason: `Duplicated from ${source.job_number}`,
  });

  return { newJobId: duplicate.id };
}
