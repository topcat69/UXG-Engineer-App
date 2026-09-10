"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";

export type ActionResult = { ok: true } | { ok: false; message: string };

/**
 * Manually logs existing warehouse stock that never came through a Job
 * Sheet's goods-in — one stock_items row per unit, same shape as the
 * kiosk's own addStockItem, just with job_sheet_id left null (see
 * 20260910010000_stock_items_nullable_job_sheet.sql). No serial numbers
 * for a bulk manual add; anything more specific still gets logged
 * individually via the kiosk when it arrives against a real Job Sheet.
 */
export async function addShelfStock(manufacturer: string, model: string, quantity: number): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Not signed in." };

  const trimmedManufacturer = manufacturer.trim();
  const trimmedModel = model.trim();
  if (!trimmedManufacturer && !trimmedModel) return { ok: false, message: "Enter a manufacturer or model." };
  if (!Number.isInteger(quantity) || quantity < 1) return { ok: false, message: "Quantity must be at least 1." };

  const supabase = await createClient();
  const now = new Date().toISOString();
  const rows = Array.from({ length: quantity }, () => ({
    job_sheet_id: null,
    manufacturer: trimmedManufacturer || null,
    model: trimmedModel || null,
    received_by: user.id,
    received_at: now,
  }));

  const { error } = await supabase.from("stock_items").insert(rows);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/stock");
  return { ok: true };
}

/**
 * Moves `quantity` shelf units of one manufacturer/model onto a Job
 * Sheet — the Stock page only shows totals (not individual items), so
 * this just claims however many un-earmarked rows match and reassigns
 * them; which physical units doesn't matter since the page treats them
 * as interchangeable at this level. Same free-text equality the rest of
 * goods-in uses (manufacturer/model are plain text, not FKs).
 */
export async function allocateStockToJob(
  manufacturer: string | null,
  model: string | null,
  jobSheetId: string,
  quantity: number,
): Promise<ActionResult> {
  if (!jobSheetId) return { ok: false, message: "Select a job sheet." };
  if (!Number.isInteger(quantity) || quantity < 1) return { ok: false, message: "Quantity must be at least 1." };

  const supabase = await createClient();

  let query = supabase.from("stock_items").select("id").is("job_sheet_id", null).limit(quantity);
  query = manufacturer === null ? query.is("manufacturer", null) : query.eq("manufacturer", manufacturer);
  query = model === null ? query.is("model", null) : query.eq("model", model);
  const { data: rows, error: selectError } = await query;
  if (selectError) return { ok: false, message: selectError.message };
  if (!rows || rows.length < quantity) {
    return { ok: false, message: `Only ${rows?.length ?? 0} on the shelf — refresh and try again.` };
  }

  const { error } = await supabase
    .from("stock_items")
    .update({ job_sheet_id: jobSheetId })
    .in(
      "id",
      rows.map((r) => r.id),
    );
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/stock");
  revalidatePath(`/office/job-sheets/${jobSheetId}`);
  return { ok: true };
}
