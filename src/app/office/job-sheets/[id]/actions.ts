"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";

export type ActionResult = { ok: true } | { ok: false; message: string };

/**
 * Permanently deletes a Job Sheet and, via on-delete-cascade, every
 * Stock Item and test result still linked to it — deliberate, per the
 * product decision that a sheet created ahead of a job that then falls
 * through (cancelled before any stock arrived, or a duplicate) should be
 * removable outright, same as deleting a Job removes its own history.
 * RLS (job_sheets_delete: superadmin/manager) is the real boundary.
 */
export async function deleteJobSheetAction(jobSheetId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Not signed in." };

  const supabase = await createClient();
  const { error } = await supabase.from("job_sheets").delete().eq("id", jobSheetId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/job-sheets");
  revalidatePath("/office/stock");
  return { ok: true };
}

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

/**
 * Pulls a Stock Item onto a different Job Sheet — Decision 7's other
 * half: stock sometimes gets pulled for a different, higher-priority
 * job, so job_sheet_id has to be a plain, freely reassignable foreign
 * key, not something locked once scanned in. No status check on either
 * sheet, same reasoning as assignJobSheetToJob above.
 */
export async function reassignStockItem(stockItemId: string, fromJobSheetId: string, toJobSheetId: string): Promise<ActionResult> {
  if (!toJobSheetId) return { ok: false, message: "Select a job sheet." };

  const supabase = await createClient();
  const { error } = await supabase.from("stock_items").update({ job_sheet_id: toJobSheetId }).eq("id", stockItemId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/office/job-sheets/${fromJobSheetId}`);
  revalidatePath(`/office/job-sheets/${toJobSheetId}`);
  revalidatePath("/office/job-sheets");
  return { ok: true };
}
