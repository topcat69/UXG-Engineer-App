import { createClient } from "@/lib/supabase/server";
import { AssetRegisterManager } from "./asset-register-manager";

/**
 * Phase 1 of the Asset Register (see the "Asset Register Scope" design
 * doc) — a durable, site-linked register of physical AV assets. Goods-in
 * auto-creates a row per scanned item (see kiosk/[id]/actions.ts's
 * addStockItem); this page is where a manager fills in the rest —
 * category, procurement, warranty — and manages the Asset Categories
 * picklist and manual entries for anything that never went through
 * goods-in.
 */
export default async function AssetRegisterPage() {
  const supabase = await createClient();

  const [{ data: assets, error }, { data: categories }, { data: sites }] = await Promise.all([
    supabase
      .from("asset_register")
      .select(
        `id, category_id, manufacturer, model, serial_number, site_id, purchase_date, supplier, po_or_invoice_number,
         purchase_cost, depreciation_method, useful_life_years, residual_value, warranty_start, warranty_end,
         warranty_provider, support_contract_ref, support_sla, status, install_date, expected_replacement_date,
         decommission_date, disposal_date, weee_reference, stock_item_id, source, needs_review, created_at,
         created_by, updated_at, updated_by,
         category:asset_categories(name), site:sites(name, client:clients(name))`,
      )
      .order("created_at", { ascending: false }),
    supabase.from("asset_categories").select("id, name").order("name"),
    supabase.from("sites").select("id, name, client:clients(name)").order("name"),
  ]);

  if (error) {
    return <p className="text-destructive">Failed to load the Asset Register: {error.message}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Asset Register</h1>
        <p className="text-muted-foreground text-sm">
          Every item scanned in through goods-in gets a row here automatically, flagged for review until its category,
          procurement, and warranty details are filled in. Install date is set automatically once the job it&apos;s part
          of is actually completed — it&apos;s never typed in.
        </p>
      </div>
      <AssetRegisterManager initialAssets={assets ?? []} categories={categories ?? []} sites={sites ?? []} />
    </div>
  );
}
