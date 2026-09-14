"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import type { Database } from "@/lib/supabase/database.types";
import type { NamedItemResult, NamedDeleteResult } from "@/components/office/flat-list-section";

type AssetStatus = Database["public"]["Enums"]["asset_status"];

export type AssetRegisterRow = Database["public"]["Tables"]["asset_register"]["Row"];

const ASSET_SELECT =
  "id, category_id, manufacturer, model, serial_number, site_id, purchase_date, supplier, po_or_invoice_number, purchase_cost, depreciation_method, useful_life_years, residual_value, warranty_start, warranty_end, warranty_provider, support_contract_ref, support_sla, status, install_date, expected_replacement_date, decommission_date, disposal_date, weee_reference, stock_item_id, source, needs_review, created_at, created_by, updated_at, updated_by";

export type AssetResult = { ok: true; item: AssetRegisterRow } | { ok: false; message: string };
export type ActionResult = { ok: true } | { ok: false; message: string };

// --- Asset Categories: same flat add/edit/delete shape as Stock Catalog's
// Manufacturers/Software Providers (see FlatListSection), just its own
// small list rather than folded into Stock Catalog — decision 3.

export async function createAssetCategory(name: string): Promise<NamedItemResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "Name is required." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("asset_categories").insert({ name: trimmed }).select("id, name").single();
  if (error) {
    if (error.code === "23505") return { ok: false, message: "That category already exists." };
    return { ok: false, message: error.message };
  }

  revalidatePath("/office/asset-register");
  return { ok: true, item: data };
}

export async function updateAssetCategory(id: string, name: string): Promise<NamedItemResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "Name is required." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("asset_categories").update({ name: trimmed }).eq("id", id).select("id, name").single();
  if (error) {
    if (error.code === "23505") return { ok: false, message: "That category already exists." };
    return { ok: false, message: error.message };
  }

  revalidatePath("/office/asset-register");
  return { ok: true, item: data };
}

/** No cascade on asset_register.category_id — a category still in use falls back to null (uncategorised) rather than being blocked from deletion, same effect as leaving a asset "needs review" until someone re-picks one. */
export async function deleteAssetCategory(id: string): Promise<NamedDeleteResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("asset_categories").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/asset-register");
  return { ok: true };
}

// --- Asset Register rows ---

export type AssetFieldsInput = {
  categoryId: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  siteId: string;
  purchaseDate: string;
  supplier: string;
  poOrInvoiceNumber: string;
  purchaseCost: string;
  depreciationMethod: string;
  usefulLifeYears: string;
  residualValue: string;
  warrantyStart: string;
  warrantyEnd: string;
  warrantyProvider: string;
  supportContractRef: string;
  supportSla: string;
  status: AssetStatus;
  expectedReplacementDate: string;
  decommissionDate: string;
  disposalDate: string;
  weeeReference: string;
  needsReview: boolean;
};

function toNullableNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function toNullableInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number.parseInt(trimmed, 10);
  return Number.isFinite(n) ? n : null;
}

/** Mirrors the asset_register_site_required_unless_spare check constraint client-side, so the error shows up next to the form rather than as a raw Postgres message. */
function fieldsToUpdate(input: AssetFieldsInput): Database["public"]["Tables"]["asset_register"]["Update"] | { error: string } {
  if (input.status !== "spare" && !input.siteId) {
    return { error: "Site is required unless status is Spare." };
  }
  return {
    category_id: input.categoryId || null,
    manufacturer: input.manufacturer.trim() || null,
    model: input.model.trim() || null,
    serial_number: input.serialNumber.trim() || null,
    site_id: input.siteId || null,
    purchase_date: input.purchaseDate || null,
    supplier: input.supplier.trim() || null,
    po_or_invoice_number: input.poOrInvoiceNumber.trim() || null,
    purchase_cost: toNullableNumber(input.purchaseCost),
    depreciation_method: input.depreciationMethod.trim() || null,
    useful_life_years: toNullableInt(input.usefulLifeYears),
    residual_value: toNullableNumber(input.residualValue),
    warranty_start: input.warrantyStart || null,
    warranty_end: input.warrantyEnd || null,
    warranty_provider: input.warrantyProvider.trim() || null,
    support_contract_ref: input.supportContractRef.trim() || null,
    support_sla: input.supportSla.trim() || null,
    status: input.status,
    expected_replacement_date: input.expectedReplacementDate || null,
    decommission_date: input.decommissionDate || null,
    disposal_date: input.disposalDate || null,
    weee_reference: input.weeeReference.trim() || null,
    needs_review: input.needsReview,
  };
}

/** Manual add — the third of the three entry doors (goods-in, import, manual). install_date is never set here: it's stamped automatically the moment the linked job is actually submitted (see api/webhooks/status-submitted), not typed in. */
export async function createAssetManually(input: AssetFieldsInput): Promise<AssetResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Not signed in." };

  const fields = fieldsToUpdate(input);
  if ("error" in fields) return { ok: false, message: fields.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("asset_register")
    .insert({ ...fields, source: "manual", needs_review: false, created_by: user.id, updated_by: user.id })
    .select(ASSET_SELECT)
    .single();
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/asset-register");
  return { ok: true, item: data };
}

/** Edits everything a manager fills in — category, device detail, location, procurement, warranty, and the manual half of lifecycle. install_date/source/stock_item_id are never touched here. */
export async function updateAssetRegister(id: string, input: AssetFieldsInput): Promise<AssetResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Not signed in." };

  const fields = fieldsToUpdate(input);
  if ("error" in fields) return { ok: false, message: fields.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("asset_register")
    .update({ ...fields, updated_by: user.id })
    .eq("id", id)
    .select(ASSET_SELECT)
    .single();
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/asset-register");
  return { ok: true, item: data };
}

export async function deleteAssetRegisterRow(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("asset_register").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/asset-register");
  return { ok: true };
}
