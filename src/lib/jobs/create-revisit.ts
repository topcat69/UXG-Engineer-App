import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { nextJobNumber } from "./job-number";
import { maxJobSequenceForYear } from "./next-job-number";
import { cloneEquipmentForJob, cloneJobDetailsForRevisit } from "./clone-job-details";

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
 * regardless of what triggered it. Also carries over the parent's
 * office-prep/equipment job_details fields and its job_equipment list (see
 * clone-job-details.ts for exactly what does and doesn't copy, and why) —
 * same site, so RAMS/site plan/serials etc. almost certainly still hold,
 * and the engineer shouldn't have to re-enter them. Best-effort past the
 * point the revisit job itself is created: a failure here still returns
 * an error (so the caller can flag it), but doesn't roll back the job,
 * matching duplicateJob's existing task-copy behaviour.
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

  const { data: parentDetails } = await supabase.from("job_details").select("*").eq("job_id", parent.id).maybeSingle();
  if (parentDetails) {
    const { error: detailsError } = await supabase
      .from("job_details")
      .insert({ job_id: revisit.id, ...cloneJobDetailsForRevisit(parentDetails) });
    if (detailsError) return { error: detailsError.message };
  }

  const { data: parentEquipment } = await supabase
    .from("job_equipment")
    .select("model, serial, position")
    .eq("job_id", parent.id)
    .order("position");
  if (parentEquipment && parentEquipment.length > 0) {
    const { error: equipmentError } = await supabase.from("job_equipment").insert(cloneEquipmentForJob(parentEquipment, revisit.id));
    if (equipmentError) return { error: equipmentError.message };
  }

  await supabase.from("status_events").insert({
    job_id: revisit.id,
    from_status: null,
    to_status: "draft",
    user_id: userId,
    reason: `Revisit created from ${parent.job_number}: ${reason}`,
  });

  return { revisitId: revisit.id };
}
