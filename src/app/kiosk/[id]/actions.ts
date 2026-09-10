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
 * Registers a scanned manufacturer/model combination into the Stock
 * Catalog when it isn't there yet, so the *next* scan of that same model
 * auto-fills instead of dropping to "Other…" again (see
 * add-stock-item-form.tsx's handleScan). Case-insensitive lookup on both
 * levels — "Sony" and "sony" typed on two different goods-in runs must
 * resolve to the same catalog row, since stock_manufacturers/stock_models'
 * own unique constraints are case-sensitive and won't catch that. Only
 * fills in a model's description if it doesn't have one yet — never
 * overwrites a description someone's already curated on the Stock
 * Catalog page with whatever was typed in a rush during goods-in.
 */
async function ensureCatalogEntry(
  supabase: SupabaseServerClient,
  manufacturer: string,
  model: string,
  description: string,
): Promise<void> {
  if (!manufacturer || !model) return;

  let manufacturerId: string;
  const { data: existingManufacturer } = await supabase
    .from("stock_manufacturers")
    .select("id")
    .ilike("name", manufacturer)
    .maybeSingle();
  if (existingManufacturer) {
    manufacturerId = existingManufacturer.id;
  } else {
    const { data: created, error } = await supabase.from("stock_manufacturers").insert({ name: manufacturer }).select("id").single();
    if (error || !created) {
      // Lost a race with a concurrent insert of the same name — fall back to
      // whatever's there now rather than failing the whole goods-in scan.
      const { data: retry } = await supabase.from("stock_manufacturers").select("id").ilike("name", manufacturer).maybeSingle();
      if (!retry) return;
      manufacturerId = retry.id;
    } else {
      manufacturerId = created.id;
    }
  }

  const { data: existingModel } = await supabase
    .from("stock_models")
    .select("id, description")
    .eq("manufacturer_id", manufacturerId)
    .ilike("name", model)
    .maybeSingle();
  if (!existingModel) {
    await supabase.from("stock_models").insert({ manufacturer_id: manufacturerId, name: model, description: description || null });
  } else if (!existingModel.description && description) {
    await supabase.from("stock_models").update({ description }).eq("id", existingModel.id);
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
  description: string,
  serialNo: string,
  hwId: string,
  firmwareUpdate: string,
  tested: boolean,
  damaged: boolean,
  damageNotes: string,
): Promise<AddStockItemResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Not signed in." };

  const supabase = await createClient();
  const now = new Date().toISOString();
  const trimmedManufacturer = manufacturer.trim();
  const trimmedModel = model.trim();
  const trimmedDescription = description.trim();

  const { error } = await supabase.from("stock_items").insert({
    job_sheet_id: jobSheetId,
    manufacturer: trimmedManufacturer || null,
    model: trimmedModel || null,
    description: trimmedDescription || null,
    serial_no: serialNo.trim() || null,
    hw_id: hwId.trim() || null,
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

  await ensureCatalogEntry(supabase, trimmedManufacturer, trimmedModel, trimmedDescription);

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

export type UploadStockItemPhotoResult = { ok: true; imagePath: string } | { ok: false; message: string };

/**
 * The paper job sheet's "Image Link" column — one photo per Stock Item,
 * uploaded straight to Storage rather than routed through PhotoSlot.tsx's
 * offline Dexie/outbox queue, which the kiosk's always-online model doesn't
 * need. Not gated on the item's or sheet's status, same as everything else
 * here (Decision 7) — a photo can be added or replaced at any point.
 */
export async function uploadStockItemPhoto(
  stockItemId: string,
  jobSheetId: string,
  formData: FormData,
): Promise<UploadStockItemPhotoResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose a file first." };

  const supabase = await createClient();
  const storagePath = `${jobSheetId}/${stockItemId}-${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from("stock-item-photos").upload(storagePath, file, {
    contentType: file.type || undefined,
  });
  if (uploadError) return { ok: false, message: uploadError.message };

  const { error } = await supabase.from("stock_items").update({ image_path: storagePath }).eq("id", stockItemId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/kiosk/${jobSheetId}`);
  revalidatePath(`/office/job-sheets/${jobSheetId}`);
  return { ok: true, imagePath: storagePath };
}

export async function deleteStockItemPhoto(stockItemId: string, jobSheetId: string, imagePath: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error: removeError } = await supabase.storage.from("stock-item-photos").remove([imagePath]);
  if (removeError) return { ok: false, message: removeError.message };

  const { error } = await supabase.from("stock_items").update({ image_path: null }).eq("id", stockItemId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/kiosk/${jobSheetId}`);
  revalidatePath(`/office/job-sheets/${jobSheetId}`);
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
