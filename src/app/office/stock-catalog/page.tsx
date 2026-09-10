import { createClient } from "@/lib/supabase/server";
import { StockCatalogManager } from "./stock-catalog-manager";

/**
 * Predefined Manufacturer/Model lists behind the kiosk's goods-in dropdowns
 * (see /kiosk/[id]/add-stock-item-form.tsx) — global, not per-customer,
 * since a piece of AV kit's manufacturer doesn't depend on which client
 * it's going to.
 */
export default async function StockCatalogPage() {
  const supabase = await createClient();

  const [{ data: manufacturers, error }, { data: models }] = await Promise.all([
    supabase.from("stock_manufacturers").select("id, name").order("name"),
    supabase.from("stock_models").select("id, name, manufacturer_id, description").order("name"),
  ]);

  if (error) {
    return <p className="text-destructive">Failed to load stock catalog: {error.message}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Stock Catalog</h1>
        <p className="text-muted-foreground text-sm">
          Manufacturers and models Warehouse can pick from when receiving stock on a Job Sheet — they can still type
          &quot;Other&quot; on the kiosk for anything not listed here yet.
        </p>
      </div>
      <StockCatalogManager initialManufacturers={manufacturers ?? []} initialModels={models ?? []} />
    </div>
  );
}
