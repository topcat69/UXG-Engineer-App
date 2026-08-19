import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { nextJobNumber } from "./job-number";
import { maxJobSequenceForYear } from "./next-job-number";

type AnySupabaseClient = SupabaseClient<Database>;

export type ParentJob = {
  id: string;
  job_number: string;
  project_id: string | null;
  site_id: string;
  job_type: string;
};

export type CreateRevisitResult = { revisitId: string } | { error: string };

/**
 * Clones site/project/type onto a new draft job with `parent_job_id` set,
 * per spec — the one place this happens, used by both QA rejection
 * (office-initiated) and the blocks_completion issue webhook
 * (field-or-office-initiated), so a revisit looks and behaves identically
 * regardless of what triggered it.
 */
export async function createRevisitJob(
  supabase: AnySupabaseClient,
  parent: ParentJob,
  reason: string,
  userId: string | null,
): Promise<CreateRevisitResult> {
  const year = new Date().getFullYear();
  const maxSeq = await maxJobSequenceForYear(supabase, year);
  const { data: revisit, error } = await supabase
    .from("jobs")
    .insert({
      job_number: nextJobNumber(maxSeq, year, 1),
      project_id: parent.project_id,
      site_id: parent.site_id,
      job_type: parent.job_type,
      status: "draft",
      parent_job_id: parent.id,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await supabase.from("status_events").insert({
    job_id: revisit.id,
    from_status: null,
    to_status: "draft",
    user_id: userId,
    reason: `Revisit created from ${parent.job_number}: ${reason}`,
  });

  return { revisitId: revisit.id };
}
