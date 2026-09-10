"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type StockListRow = { id: string; name: string };
type ItemResult = { ok: true; item: StockListRow } | { ok: false; message: string };
type DeleteResult = { ok: true } | { ok: false; message: string };

export async function createManufacturer(name: string): Promise<ItemResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "Name is required." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("stock_manufacturers").insert({ name: trimmed }).select("id, name").single();
  if (error) {
    if (error.code === "23505") return { ok: false, message: "That manufacturer already exists." };
    return { ok: false, message: error.message };
  }

  revalidatePath("/office/stock-catalog");
  return { ok: true, item: data };
}

export async function updateManufacturer(id: string, name: string): Promise<ItemResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "Name is required." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("stock_manufacturers").update({ name: trimmed }).eq("id", id).select("id, name").single();
  if (error) {
    if (error.code === "23505") return { ok: false, message: "That manufacturer already exists." };
    return { ok: false, message: error.message };
  }

  revalidatePath("/office/stock-catalog");
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
