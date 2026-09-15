import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// Callers pass either the request-scoped SSR client (kiosk's own session,
// where warehouse's insert/update grant on stock_manufacturers/stock_models
// covers this directly) or the service-role admin client (Damaged
// Equipment's manual-add form, usable by finance too, which has no such
// grant — see 20260910040000_stock_catalog_warehouse_write.sql).
type AnySupabaseClient = SupabaseClient<Database>;

/**
 * Registers a manufacturer/model combination into the Stock Catalog when
 * it isn't there yet, so the *next* time it's picked it auto-fills instead
 * of dropping to "Other…" again. Case-insensitive lookup on both levels —
 * "Sony" and "sony" typed on two different occasions must resolve to the
 * same catalog row, since stock_manufacturers/stock_models' own unique
 * constraints are case-sensitive and won't catch that. Only fills in a
 * model's description if it doesn't have one yet — never overwrites a
 * description someone's already curated on the Stock Catalog page with
 * whatever was typed in a rush at goods-in or on a Damaged Equipment entry.
 */
export async function ensureCatalogEntry(
  supabase: AnySupabaseClient,
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
      // whatever's there now rather than failing the whole calling action.
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
