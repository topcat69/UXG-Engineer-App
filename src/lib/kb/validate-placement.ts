import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type AnySupabaseClient = SupabaseClient<Database>;

/**
 * An article can be filed at whichever level is specific enough — category
 * alone, category+manufacturer, or all three (Category -> Manufacturer ->
 * Model range) — but whatever's given has to actually nest correctly (a
 * manufacturer under this category, a model range under that
 * manufacturer). Shared between office's createArticle/updateArticle and
 * the engineer-facing submitArticle/resubmitArticle (src/lib/kb/actions.ts)
 * since both need the exact same check. The cascading category pickers in
 * both forms shouldn't be able to produce a mismatched combination, but
 * it's still worth checking server-side rather than trusting three
 * independently-supplied ids.
 */
export async function validatePlacement(
  supabase: AnySupabaseClient,
  categoryId: string,
  manufacturerId: string,
  modelRangeId: string,
): Promise<string | null> {
  if (modelRangeId) {
    if (!manufacturerId) return "A model range needs a manufacturer selected too.";
    const { data } = await supabase.from("kb_model_ranges").select("manufacturer_id").eq("id", modelRangeId).single();
    if (!data || data.manufacturer_id !== manufacturerId) return "That model range doesn't belong to the selected manufacturer.";
  }
  if (manufacturerId) {
    const { data } = await supabase.from("kb_manufacturers").select("category_id").eq("id", manufacturerId).single();
    if (!data || data.category_id !== categoryId) return "That manufacturer doesn't belong to the selected category.";
  }
  return null;
}
