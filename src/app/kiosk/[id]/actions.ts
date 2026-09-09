"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import type { Database } from "@/lib/supabase/database.types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type AddStockItemResult = { ok: true } | { ok: false; message: string };

/**
 * Moves a sheet on to "Configuring" the first time any configuration
 * work lands on it — a test result, a software setting — but never
 * backs it up again once it's moved further (Ready/Assigned/Complete),
 * matching Decision 7: stages don't lock each other out, and Warehouse
 * can still add a late unit after this has already run.
 */
async function bumpToConfiguring(supabase: SupabaseServerClient, jobSheetId: string): Promise<void> {
  const { data: jobSheet } = await supabase.from("job_sheets").select("status").eq("id", jobSheetId).single();
  if (jobSheet?.status === "building" || jobSheet?.status === "receiving") {
    await supabase.from("job_sheets").update({ status: "configuring" }).eq("id", jobSheetId);
  }
}

/**
 * One call per unit — a delivery of 10 screens is 10 calls, each landing
 * straight on this Job Sheet (see the proposal's flow diagram). The first
 * item received on a still-"Building" sheet moves it to "Receiving";
 * later items don't re-trigger anything, matching Decision 7's "don't
 * lock stages" — Warehouse can keep adding after Configurator has
 * started, and this never regresses a sheet that's moved further on.
 */
export async function addStockItem(
  jobSheetId: string,
  manufacturer: string,
  model: string,
  serialNo: string,
  firmwareUpdate: string,
  tested: boolean,
  damaged: boolean,
  damageNotes: string,
): Promise<AddStockItemResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Not signed in." };

  const supabase = await createClient();
  const now = new Date().toISOString();

  const { error } = await supabase.from("stock_items").insert({
    job_sheet_id: jobSheetId,
    manufacturer: manufacturer.trim() || null,
    model: model.trim() || null,
    serial_no: serialNo.trim() || null,
    firmware_update: firmwareUpdate.trim() || null,
    tested,
    tested_at: tested ? now : null,
    tested_by: tested ? user.id : null,
    damaged,
    damage_notes: damaged ? damageNotes.trim() || null : null,
    received_by: user.id,
    received_at: now,
  });
  if (error) return { ok: false, message: error.message };

  const { data: jobSheet } = await supabase.from("job_sheets").select("status").eq("id", jobSheetId).single();
  if (jobSheet?.status === "building") {
    await supabase.from("job_sheets").update({ status: "receiving" }).eq("id", jobSheetId);
  }

  revalidatePath(`/kiosk/${jobSheetId}`);
  revalidatePath("/kiosk");
  return { ok: true };
}

export type ActionResult = { ok: true } | { ok: false; message: string };

/** One row per functional test — the "all players etc tested" grid, separate from a Stock Item's own receipt-time tested flag. */
export async function addTestResult(
  jobSheetId: string,
  itemDescription: string,
  irBud: boolean,
  wifiCable: string,
  tested: boolean,
  outcome: string,
  notes: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Not signed in." };

  const supabase = await createClient();

  const { count } = await supabase
    .from("job_sheet_tests")
    .select("id", { count: "exact", head: true })
    .eq("job_sheet_id", jobSheetId);

  const { error } = await supabase.from("job_sheet_tests").insert({
    job_sheet_id: jobSheetId,
    position: (count ?? 0) + 1,
    item_description: itemDescription.trim() || null,
    ir_bud: irBud,
    wifi_cable: wifiCable.trim() || null,
    tested,
    tested_by: tested ? user.id : null,
    outcome: outcome.trim() || null,
    notes: notes.trim() || null,
  });
  if (error) return { ok: false, message: error.message };

  await bumpToConfiguring(supabase, jobSheetId);

  revalidatePath(`/kiosk/${jobSheetId}`);
  return { ok: true };
}

export type SoftwareSetupInput = {
  cmsName: string;
  licenceAdded: boolean;
  teamviewerAdded: boolean;
  addedToUxgAccount: boolean;
  softwareNotes: string;
};

export async function updateSoftwareSetup(jobSheetId: string, input: SoftwareSetupInput): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("job_sheets")
    .update({
      cms_name: input.cmsName.trim() || null,
      licence_added: input.licenceAdded,
      teamviewer_added: input.teamviewerAdded,
      added_to_uxg_account: input.addedToUxgAccount,
      software_notes: input.softwareNotes.trim() || null,
    })
    .eq("id", jobSheetId);
  if (error) return { ok: false, message: error.message };

  await bumpToConfiguring(supabase, jobSheetId);

  revalidatePath(`/kiosk/${jobSheetId}`);
  return { ok: true };
}

type ChecklistItemInput = { flag: boolean; detail: string; photo: boolean };

export type ClosingChecklistInput = {
  defects: ChecklistItemInput;
  missingItems: ChecklistItemInput;
  packedCorrectly: ChecklistItemInput;
  otherPartsUsed: ChecklistItemInput;
  otherIssues: ChecklistItemInput;
  workAreaTidy: boolean;
};

export async function updateClosingChecklist(jobSheetId: string, input: ClosingChecklistInput): Promise<ActionResult> {
  const supabase = await createClient();

  const update: Database["public"]["Tables"]["job_sheets"]["Update"] = {
    defects: input.defects.flag,
    defects_detail: input.defects.detail.trim() || null,
    defects_photo: input.defects.photo,
    missing_items: input.missingItems.flag,
    missing_items_detail: input.missingItems.detail.trim() || null,
    missing_items_photo: input.missingItems.photo,
    packed_correctly: input.packedCorrectly.flag,
    packed_correctly_detail: input.packedCorrectly.detail.trim() || null,
    packed_correctly_photo: input.packedCorrectly.photo,
    other_parts_used: input.otherPartsUsed.flag,
    other_parts_used_detail: input.otherPartsUsed.detail.trim() || null,
    other_parts_used_photo: input.otherPartsUsed.photo,
    other_issues: input.otherIssues.flag,
    other_issues_detail: input.otherIssues.detail.trim() || null,
    other_issues_photo: input.otherIssues.photo,
    work_area_tidy: input.workAreaTidy,
  };

  const { error } = await supabase.from("job_sheets").update(update).eq("id", jobSheetId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/kiosk/${jobSheetId}`);
  return { ok: true };
}

/**
 * Name + timestamp, not a signature (Decision 2) — the signed-in
 * Configurator's own account stands in for both. Always moves the sheet
 * to "Ready" outright, regardless of its current status: Decision 7
 * means nothing should be able to block this on a technicality.
 */
export async function signOffJobSheet(jobSheetId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Not signed in." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("job_sheets")
    .update({ signed_off_by: user.id, signed_off_at: new Date().toISOString(), status: "ready" })
    .eq("id", jobSheetId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/kiosk/${jobSheetId}`);
  revalidatePath("/kiosk");
  return { ok: true };
}
