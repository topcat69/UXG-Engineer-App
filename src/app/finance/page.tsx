import { createClient } from "@/lib/supabase/server";
import { AssetRegisterManager } from "@/components/office/asset-register-manager";

/**
 * Finance's whole app surface — the Asset Register, minus category
 * management and delete (see 20260914040000_finance_asset_register_access.sql
 * for the RLS grants this mirrors).
 */
export default async function FinancePage() {
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
          Fill in financial and warranty details for each asset. Categories and asset deletion are managed by the
          office team.
        </p>
      </div>
      <AssetRegisterManager
        initialAssets={assets ?? []}
        categories={categories ?? []}
        sites={sites ?? []}
        canManageCategories={false}
        canDelete={false}
      />
    </div>
  );
}
