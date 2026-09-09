"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CreateJobSheetResult = { ok: true; jobSheetId: string } | { ok: false; message: string };

/**
 * Creates a Job Sheet's header — everything Office fills in at this stage,
 * per the "Who fills in what, and when" stage table in the Goods-In & Job
 * Sheets proposal. Warehouse and Configurator add to the same record later
 * (Phases 3-4); this is just the "Building" starting point.
 */
export async function createJobSheet(
  projectId: string,
  siteId: string,
  reference: string,
  proposedInstallDate: string,
  jobDescription: string,
): Promise<CreateJobSheetResult> {
  if (!projectId) return { ok: false, message: "Select a project." };
  if (!siteId) return { ok: false, message: "Select a site." };
  if (!reference.trim()) return { ok: false, message: "Enter a job reference." };

  const supabase = await createClient();

  // The form derives its site list from the chosen project's client, so
  // this can't happen from the UI — but nothing at the DB level ties a
  // site to a project, so it's still worth guarding server-side (same
  // reasoning as createJob's own project/site client_id check).
  const [{ data: project }, { data: site }] = await Promise.all([
    supabase.from("projects").select("client_id").eq("id", projectId).single(),
    supabase.from("sites").select("client_id").eq("id", siteId).single(),
  ]);
  if (project?.client_id && site?.client_id && project.client_id !== site.client_id) {
    return { ok: false, message: "That site doesn't belong to this project's customer." };
  }

  const { data: jobSheet, error } = await supabase
    .from("job_sheets")
    .insert({
      reference: reference.trim(),
      project_id: projectId,
      site_id: siteId,
      proposed_install_date: proposedInstallDate || null,
      job_description: jobDescription.trim() || null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/job-sheets");
  return { ok: true, jobSheetId: jobSheet.id };
}
