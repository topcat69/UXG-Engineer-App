"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/current-user";
import { sendDamagedStockAlertEmail } from "@/lib/email/send-damaged-equipment-emails";
import { ensureCatalogEntry } from "@/lib/stock/ensure-catalog-entry";
import type { Database } from "@/lib/supabase/database.types";

type DamageResolution = Database["public"]["Enums"]["damage_resolution"];

export type ActionResult = { ok: true } | { ok: false; message: string };

export type ManualDamagedEquipmentInput = {
  manufacturer: string;
  model: string;
  description: string;
  serialNumber: string;
  siteId: string;
  damageNotes: string;
};

/**
 * "Something fell off the shelf" — logged directly, no stock item or asset
 * register row behind it (see record-damage.ts's own comment on why the
 * goods-in path and this one stay separate). Still fans out the same
 * Damaged Stock Alert email, since Decision 3 of the scope doesn't
 * distinguish automatic from manual when it comes to who gets told.
 */
export async function createDamagedEquipment(input: ManualDamagedEquipmentInput): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Not signed in." };

  const trimmedManufacturer = input.manufacturer.trim();
  const trimmedModel = input.model.trim();
  const trimmedDescription = input.description.trim();

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("damaged_equipment")
    .insert({
      manufacturer: trimmedManufacturer || null,
      model: trimmedModel || null,
      description: trimmedDescription || null,
      serial_number: input.serialNumber.trim() || null,
      site_id: input.siteId || null,
      damage_notes: input.damageNotes.trim() || null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };

  // Admin client throughout below: stock_manufacturers/stock_models write
  // is superadmin/manager/warehouse only (see
  // 20260910040000_stock_catalog_warehouse_write.sql) and users_select
  // doesn't let warehouse/finance read other users' rows — but both the
  // catalog registration and the alert fan-out must work regardless of
  // which of the four allowed roles logged this, same reasoning as
  // record-damage.ts.
  const admin = createAdminClient();
  await ensureCatalogEntry(admin, trimmedManufacturer, trimmedModel, trimmedDescription);

  const { data: recipients } = await admin
    .from("users")
    .select("email")
    .in("role", ["superadmin", "manager", "warehouse", "finance"])
    .eq("active", true);
  await Promise.all((recipients ?? []).map((r) => sendDamagedStockAlertEmail(admin, row.id, r.email)));

  revalidatePath("/damaged-equipment");
  return { ok: true };
}

/** Save-on-change, same convention as every other single-field dropdown in this app. */
export async function updateDamagedEquipmentNextStep(id: string, nextStep: DamageResolution): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Not signed in." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("damaged_equipment")
    .update({ next_step: nextStep, updated_by: user.id })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/damaged-equipment");
  return { ok: true };
}

export type UploadPhotoResult = { ok: true; photoPath: string } | { ok: false; message: string };

/** One photo per damaged item, same convention as stock_items.image_path. */
export async function uploadDamagedEquipmentPhoto(id: string, formData: FormData): Promise<UploadPhotoResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose a file first." };

  const supabase = await createClient();
  const storagePath = `${id}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from("damaged-equipment-photos").upload(storagePath, file, {
    contentType: file.type || undefined,
  });
  if (uploadError) return { ok: false, message: uploadError.message };

  const { error } = await supabase.from("damaged_equipment").update({ photo_path: storagePath }).eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/damaged-equipment");
  return { ok: true, photoPath: storagePath };
}

export async function deleteDamagedEquipmentPhoto(id: string, photoPath: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error: removeError } = await supabase.storage.from("damaged-equipment-photos").remove([photoPath]);
  if (removeError) return { ok: false, message: removeError.message };

  const { error } = await supabase.from("damaged_equipment").update({ photo_path: null }).eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/damaged-equipment");
  return { ok: true };
}

/** RLS restricts this to superadmin/manager — Warehouse/Finance can view/create/set the next step, not delete. */
export async function deleteDamagedEquipment(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("damaged_equipment").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/damaged-equipment");
  return { ok: true };
}
