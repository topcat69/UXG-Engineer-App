"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";

export type AddStockItemResult = { ok: true } | { ok: false; message: string };

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
