import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendDamagedStockAlertEmail } from "@/lib/email/send-damaged-equipment-emails";

/**
 * The goods-in side of the Damaged Equipment feature (decisions 1/2/3/4 of
 * its scope): whenever a stock item is flagged damaged — at goods-in scan
 * time, or retroactively via an edit that flips damaged false -> true —
 * copy it into damaged_equipment, mark its existing asset_register row (see
 * registerGoodsInAsset in kiosk/[id]/actions.ts — every goods-in scan
 * already gets one) as faulty, and alert every active superadmin/manager/
 * warehouse/finance user. Runs on the admin client throughout: asset_register
 * update is superadmin/manager/finance-only per its own RLS, but this must
 * work regardless of which of those four roles triggered the damage flag
 * (most often warehouse, at the kiosk) — same reasoning as
 * registerGoodsInAsset's own admin-client email fan-out.
 *
 * Manual "logged directly" damage (something damaged on a shelf, never
 * through goods-in) doesn't go through this path — see createDamagedEquipment
 * in office/damaged-equipment/actions.ts, which has no stock item or asset
 * register row to link.
 */
export async function recordDamagedStockItem(params: {
  stockItemId: string;
  jobSheetId: string;
  manufacturer: string | null;
  model: string | null;
  description: string | null;
  serialNo: string | null;
  damageNotes: string;
  createdBy: string;
}): Promise<void> {
  const admin = createAdminClient();

  const { data: jobSheet } = await admin.from("job_sheets").select("site_id").eq("id", params.jobSheetId).single();

  const { data: assetRow } = await admin
    .from("asset_register")
    .select("id")
    .eq("stock_item_id", params.stockItemId)
    .maybeSingle();

  if (assetRow) {
    await admin.from("asset_register").update({ status: "faulty", needs_review: true }).eq("id", assetRow.id);
  }

  const { data: damagedRow, error } = await admin
    .from("damaged_equipment")
    .insert({
      stock_item_id: params.stockItemId,
      asset_register_id: assetRow?.id ?? null,
      manufacturer: params.manufacturer,
      model: params.model,
      description: params.description,
      serial_number: params.serialNo,
      site_id: jobSheet?.site_id ?? null,
      damage_notes: params.damageNotes.trim() || null,
      created_by: params.createdBy,
      updated_by: params.createdBy,
    })
    .select("id")
    .single();
  if (error || !damagedRow) return;

  const { data: recipients } = await admin
    .from("users")
    .select("email")
    .in("role", ["superadmin", "manager", "warehouse", "finance"])
    .eq("active", true);
  await Promise.all((recipients ?? []).map((r) => sendDamagedStockAlertEmail(admin, damagedRow.id, r.email)));
}
