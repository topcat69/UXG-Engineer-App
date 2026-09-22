"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type StockListRow = { id: string; name: string };
type ItemResult = { ok: true; item: StockListRow } | { ok: false; message: string };
type DeleteResult = { ok: true } | { ok: false; message: string };

export type ManufacturerRow = { id: string; name: string; category_id: string | null };
type ManufacturerResult = { ok: true; item: ManufacturerRow } | { ok: false; message: string };

/**
 * Bulk-categorises Asset Register — every row still uncategorised
 * (category_id is null) whose free-text manufacturer matches this
 * manufacturer's name gets this category. Fill-only, same "whichever was
 * set first wins" convention as PO number reconciliation elsewhere
 * (assignJobSheetToJob) — an asset a manager already categorised by hand
 * is left alone rather than silently overwritten every time this
 * manufacturer's category changes.
 */
async function backfillAssetCategoryForManufacturer(supabase: SupabaseServerClient, manufacturerName: string, categoryId: string) {
  await supabase.from("asset_register").update({ category_id: categoryId }).eq("manufacturer", manufacturerName).is("category_id", null);
}

export async function createManufacturer(name: string, categoryId: string | null): Promise<ManufacturerResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "Name is required." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_manufacturers")
    .insert({ name: trimmed, category_id: categoryId })
    .select("id, name, category_id")
    .single();
  if (error) {
    if (error.code === "23505") return { ok: false, message: "That manufacturer already exists." };
    return { ok: false, message: error.message };
  }

  if (categoryId) await backfillAssetCategoryForManufacturer(supabase, trimmed, categoryId);

  revalidatePath("/office/stock-catalog");
  revalidatePath("/office/asset-register");
  return { ok: true, item: data };
}

export async function updateManufacturer(id: string, name: string, categoryId: string | null): Promise<ManufacturerResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "Name is required." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_manufacturers")
    .update({ name: trimmed, category_id: categoryId })
    .eq("id", id)
    .select("id, name, category_id")
    .single();
  if (error) {
    if (error.code === "23505") return { ok: false, message: "That manufacturer already exists." };
    return { ok: false, message: error.message };
  }

  if (categoryId) await backfillAssetCategoryForManufacturer(supabase, trimmed, categoryId);

  revalidatePath("/office/stock-catalog");
  revalidatePath("/office/asset-register");
  return { ok: true, item: data };
}

/** No cascade (see 20260910000000_stock_manufacturers_models.sql) — a manufacturer still holding models can't be silently deleted out from under them. */
export async function deleteManufacturer(id: string): Promise<DeleteResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("stock_manufacturers").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") return { ok: false, message: "Can't delete — remove its models first." };
    return { ok: false, message: error.message };
  }

  revalidatePath("/office/stock-catalog");
  return { ok: true };
}

export type StockModelRow = { id: string; name: string; manufacturer_id: string; description: string | null };
type ModelResult = { ok: true; item: StockModelRow } | { ok: false; message: string };

/**
 * Description can be set here, or picked up automatically from a kiosk
 * goods-in scan (see ensureCatalogEntry in kiosk/[id]/actions.ts, which
 * only fills a blank description and never overwrites one curated here) —
 * either way it's the same stock_models.description column, so it shows
 * up everywhere a Model dropdown reads the catalog.
 */
export async function createModel(manufacturerId: string, name: string, description: string): Promise<ModelResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "Name is required." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_models")
    .insert({ manufacturer_id: manufacturerId, name: trimmed, description: description.trim() || null })
    .select("id, name, manufacturer_id, description")
    .single();
  if (error) {
    if (error.code === "23505") return { ok: false, message: "That model already exists for this manufacturer." };
    return { ok: false, message: error.message };
  }

  revalidatePath("/office/stock-catalog");
  return { ok: true, item: data };
}

export async function updateModel(id: string, name: string, description: string): Promise<ModelResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "Name is required." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_models")
    .update({ name: trimmed, description: description.trim() || null })
    .eq("id", id)
    .select("id, name, manufacturer_id, description")
    .single();
  if (error) {
    if (error.code === "23505") return { ok: false, message: "That model already exists for this manufacturer." };
    return { ok: false, message: error.message };
  }

  revalidatePath("/office/stock-catalog");
  return { ok: true, item: data };
}

export async function deleteModel(id: string): Promise<DeleteResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("stock_models").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/stock-catalog");
  return { ok: true };
}

/** Flat picklist, same shape as Manufacturers — no second level underneath it. */
export async function createSoftwareProvider(name: string): Promise<ItemResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "Name is required." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("stock_software_providers").insert({ name: trimmed }).select("id, name").single();
  if (error) {
    if (error.code === "23505") return { ok: false, message: "That software provider already exists." };
    return { ok: false, message: error.message };
  }

  revalidatePath("/office/stock-catalog");
  return { ok: true, item: data };
}

export async function updateSoftwareProvider(id: string, name: string): Promise<ItemResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "Name is required." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_software_providers")
    .update({ name: trimmed })
    .eq("id", id)
    .select("id, name")
    .single();
  if (error) {
    if (error.code === "23505") return { ok: false, message: "That software provider already exists." };
    return { ok: false, message: error.message };
  }

  revalidatePath("/office/stock-catalog");
  return { ok: true, item: data };
}

export async function deleteSoftwareProvider(id: string): Promise<DeleteResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("stock_software_providers").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/stock-catalog");
  return { ok: true };
}
