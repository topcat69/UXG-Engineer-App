"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; message: string };

/**
 * Links a Job Sheet to the job it's actually going out for, and moves it
 * to "Assigned". Not gated on the sheet's current status — Decision 7 in
 * the proposal is explicit that stages don't lock each other out, so
 * nothing here should refuse an early or late assignment on a
 * technicality; RLS and this page (Office/Manager only) are the real
 * boundary, not a status check.
 */
export async function assignJobSheetToJob(jobSheetId: string, jobId: string): Promise<ActionResult> {
  if (!jobId) return { ok: false, message: "Select a job." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("job_sheets")
    .update({ linked_job_id: jobId, status: "assigned" })
    .eq("id", jobSheetId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/office/job-sheets/${jobSheetId}`);
  revalidatePath("/office/job-sheets");
  return { ok: true };
}
