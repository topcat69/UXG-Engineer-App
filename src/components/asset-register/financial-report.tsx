import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/office/stat-tile";
import { createClient } from "@/lib/supabase/server";
import { formatGbp } from "@/lib/format/currency";
import { humanize } from "@/lib/format/text";
import type { Database } from "@/lib/supabase/database.types";

type AssetStatus = Database["public"]["Enums"]["asset_status"];
const ASSET_STATUSES: AssetStatus[] = ["spare", "in_use", "faulty", "in_repair", "retired"];

export type FinancialSearchParams = { category_id?: string; status?: string };

/**
 * Every procurement/financial field entered on an asset, in one table —
 * today the only way to see these is to open each asset's Edit form one
 * at a time. Deliberately doesn't repeat the Depreciation report's
 * calculated figures (accumulated depreciation, book value); this page is
 * "what's on file", that one is "what it's worth now".
 *
 * Shared between /office/asset-register/financial (manager/superadmin)
 * and /finance/financial (finance/superadmin) — basePath supplies the
 * "back" and "clear filters" links for whichever surface rendered it.
 */
export async function AssetFinancialReport({
  searchParams,
  basePath,
}: {
  searchParams: Promise<FinancialSearchParams>;
  basePath: string;
}) {
  const { category_id: categoryId = "", status = "" } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("asset_register")
    .select(
      `id, manufacturer, model, serial_number, status, purchase_date, supplier, po_or_invoice_number, purchase_cost,
       depreciation_method, useful_life_years, residual_value,
       category:asset_categories(name), site:sites(name, client:clients(name))`,
    )
    .order("purchase_date", { ascending: true, nullsFirst: false });
  if (categoryId) query = query.eq("category_id", categoryId);
  if (status) query = query.eq("status", status as AssetStatus);

  const [{ data: assets, error }, { data: categories }] = await Promise.all([
    query,
    supabase.from("asset_categories").select("id, name").order("name"),
  ]);

  if (error) {
    return <p className="text-destructive">Failed to load the financial report: {error.message}</p>;
  }

  const rows = assets ?? [];
  const withCost = rows.filter((r) => r.purchase_cost != null);
  const totalPurchaseCost = withCost.reduce((sum, r) => sum + (r.purchase_cost ?? 0), 0);
  const totalResidualValue = rows.reduce((sum, r) => sum + (r.residual_value ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Asset Financial Report</h1>
          <p className="text-muted-foreground text-sm">
            Procurement and financial details on file for every asset — supplier, PO/invoice number, cost, and the
            depreciation figures entered against it.
          </p>
        </div>
        <Link href={basePath} className="text-sm whitespace-nowrap underline-offset-2 hover:underline">
          Back to Asset Register
        </Link>
      </div>

      <form className="flex flex-wrap items-end gap-2" method="get">
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs" htmlFor="category_id">
            Category
          </label>
          <select
            id="category_id"
            name="category_id"
            defaultValue={categoryId}
            className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            <option value="">All</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs" htmlFor="status">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status}
            className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            <option value="">All</option>
            {ASSET_STATUSES.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="border-input h-9 rounded-md border px-4 text-sm hover:bg-accent">
          Filter
        </button>
        {(categoryId || status) && (
          <Link href={`${basePath}/financial`} className="text-muted-foreground text-sm underline">
            Clear
          </Link>
        )}
      </form>

      <div className="flex flex-wrap gap-4">
        <StatTile label="Total purchase cost" value={formatGbp(totalPurchaseCost)} detail={`${withCost.length} of ${rows.length} asset(s) costed`} />
        <StatTile label="Total residual value" value={formatGbp(totalResidualValue)} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 font-medium">Category</th>
              <th className="py-2 font-medium">Item</th>
              <th className="py-2 font-medium">Client</th>
              <th className="py-2 font-medium">Status</th>
              <th className="py-2 font-medium">Purchased</th>
              <th className="py-2 font-medium">Supplier</th>
              <th className="py-2 font-medium">PO / invoice #</th>
              <th className="py-2 font-medium">Cost</th>
              <th className="py-2 font-medium">Depreciation method</th>
              <th className="py-2 font-medium">Useful life (yrs)</th>
              <th className="py-2 font-medium">Residual value</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={11} className="text-muted-foreground py-6 text-center">
                  No assets match these filters.
                </td>
              </tr>
            )}
            {rows.map((asset) => {
              const itemLabel = [asset.manufacturer, asset.model].filter(Boolean).join(" ") || "—";
              return (
                <tr key={asset.id} className="border-b">
                  <td className="py-2">{asset.category?.name ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="py-2">
                    {itemLabel}
                    {asset.serial_number ? <span className="text-muted-foreground"> — {asset.serial_number}</span> : null}
                  </td>
                  <td className="py-2 text-muted-foreground">{asset.site?.client?.name ?? "—"}</td>
                  <td className="py-2">
                    <Badge variant="secondary">{humanize(asset.status)}</Badge>
                  </td>
                  <td className="py-2 text-muted-foreground">{asset.purchase_date ?? "—"}</td>
                  <td className="py-2 text-muted-foreground">{asset.supplier ?? "—"}</td>
                  <td className="py-2 text-muted-foreground">{asset.po_or_invoice_number ?? "—"}</td>
                  <td className="py-2 tabular-nums">{formatGbp(asset.purchase_cost)}</td>
                  <td className="py-2 text-muted-foreground">{asset.depreciation_method ?? "—"}</td>
                  <td className="py-2 tabular-nums">{asset.useful_life_years ?? "—"}</td>
                  <td className="py-2 tabular-nums">{formatGbp(asset.residual_value)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
