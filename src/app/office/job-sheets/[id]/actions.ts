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
 *
 * Also reconciles PO Number between the two records — whichever one was
 * filled in first "wins" and fills the other, since assignment is the
 * first moment they're actually connected. If both already have a value
 * (and they differ), neither is touched: a same-order overwrite here
 * would silently discard whichever one wasn't picked, with no way to
 * tell the two apart afterward.
 */
export async function assignJobSheetToJob(jobSheetId: string, jobId: string): Promise<ActionResult> {
  if (!jobId) return { ok: false, message: "Select a job." };

  const supabase = await createClient();

  const [{ data: jobSheet }, { data: job }] = await Promise.all([
    supabase.from("job_sheets").select("po_number").eq("id", jobSheetId).single(),
    supabase.from("jobs").select("quickbooks_no").eq("id", jobId).single(),
  ]);
  const sheetPo = jobSheet?.po_number?.trim() || null;
  const jobPo = job?.quickbooks_no?.trim() || null;

  const { error } = await supabase
    .from("job_sheets")
    .update({ linked_job_id: jobId, status: "assigned", ...(!sheetPo && jobPo ? { po_number: jobPo } : {}) })
    .eq("id", jobSheetId);
  if (error) return { ok: false, message: error.message };

  if (!jobPo && sheetPo) {
    const { error: jobUpdateError } = await supabase.from("jobs").update({ quickbooks_no: sheetPo }).eq("id", jobId);
    if (jobUpdateError) return { ok: false, message: jobUpdateError.message };
  }

  revalidatePath(`/office/job-sheets/${jobSheetId}`);
  revalidatePath("/office/job-sheets");
  revalidatePath(`/office/jobs/${jobId}`);
  return { ok: true };
}

/**
 * Edits the Job Sheet's own PO Number. If the sheet is already linked to
 * a job, the job's copy (`jobs.quickbooks_no` — the same "purchase order
 * reference" concept, see 20260914050000_job_sheet_po_number.sql)
 * updates too, since Office explicitly editing it here is exactly the
 * "filled out and saved" moment that should propagate — unlike the
 * fill-only reconciliation in assignJobSheetToJob, this one intentionally
 * overwrites the job's value.
 */
export async function updateJobSheetPoNumber(jobSheetId: string, poNumber: string): Promise<ActionResult> {
  const supabase = await createClient();
  const trimmed = poNumber.trim() || null;

  const { data: jobSheet, error } = await supabase
    .from("job_sheets")
    .update({ po_number: trimmed })
    .eq("id", jobSheetId)
    .select("linked_job_id")
    .single();
  if (error) return { ok: false, message: error.message };

  if (jobSheet.linked_job_id) {
    const { error: jobUpdateError } = await supabase
      .from("jobs")
      .update({ quickbooks_no: trimmed })
      .eq("id", jobSheet.linked_job_id);
    if (jobUpdateError) return { ok: false, message: jobUpdateError.message };
    revalidatePath(`/office/jobs/${jobSheet.linked_job_id}`);
  }

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

  // Its Configuration row (see addStockItem in kiosk/[id]/actions.ts)
  // moves with it — otherwise it'd keep showing up on the sheet the item
  // just left.
  await supabase.from("job_sheet_tests").update({ job_sheet_id: toJobSheetId }).eq("stock_item_id", stockItemId);

  // Its Asset Register row (see registerGoodsInAsset in
  // kiosk/[id]/actions.ts) moves site with it too, same reasoning.
  const { data: toJobSheet } = await supabase.from("job_sheets").select("site_id").eq("id", toJobSheetId).single();
  if (toJobSheet) {
    await supabase.from("asset_register").update({ site_id: toJobSheet.site_id }).eq("stock_item_id", stockItemId);
  }

  revalidatePath(`/office/job-sheets/${fromJobSheetId}`);
  revalidatePath(`/office/job-sheets/${toJobSheetId}`);
  revalidatePath("/office/job-sheets");
  return { ok: true };
}

/**
 * Permanently removes a Stock Item added in error — the counterpart to
 * moving one (above): sometimes there's simply nowhere to move it to, but
 * it still shouldn't sit on this sheet. Its Configuration row (see
 * job_sheet_tests.stock_item_id) cascades with it; a linked Asset Register
 * or Damaged Equipment row (traceability links only, never load-bearing)
 * just loses that reference rather than being deleted too.
 */
export async function deleteStockItem(stockItemId: string, jobSheetId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: item } = await supabase.from("stock_items").select("image_path").eq("id", stockItemId).single();

  const { error } = await supabase.from("stock_items").delete().eq("id", stockItemId);
  if (error) return { ok: false, message: error.message };

  // Best-effort — an orphaned photo left in storage is harmless; the row
  // is already gone either way, so a storage failure here shouldn't read
  // back to the user as "delete failed".
  if (item?.image_path) await supabase.storage.from("stock-item-photos").remove([item.image_path]);

  revalidatePath(`/office/job-sheets/${jobSheetId}`);
  revalidatePath("/office/job-sheets");
  revalidatePath("/office/stock");
  return { ok: true };
}
