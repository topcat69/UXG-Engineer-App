import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/office/stat-tile";
import { createClient } from "@/lib/supabase/server";
import { computeStraightLineDepreciation } from "@/lib/asset-register/depreciation";
import { formatGbp } from "@/lib/format/currency";
import { humanize } from "@/lib/format/text";
import type { Database } from "@/lib/supabase/database.types";

type AssetStatus = Database["public"]["Enums"]["asset_status"];
const ASSET_STATUSES: AssetStatus[] = ["spare", "in_use", "faulty", "in_repair", "retired"];

type DepreciationSearchParams = { category_id?: string; status?: string };

/**
 * Phase 3 of the Asset Register — a point-in-time (as of today) straight-
 * line depreciation report over everything in the register. An asset
 * missing purchase date, purchase cost, or useful life still shows up in
 * the table (so it's visible that it's incomplete) but is left out of the
 * totals row, since there's nothing to calculate for it — see
 * computeStraightLineDepreciation.
 */
export default async function DepreciationReportPage({
  searchParams,
}: {
  searchParams: Promise<DepreciationSearchParams>;
}) {
  const { category_id: categoryId = "", status = "" } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("asset_register")
    .select(
      `id, manufacturer, model, serial_number, status, purchase_date, purchase_cost, useful_life_years, residual_value,
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
    return <p className="text-destructive">Failed to load the depreciation report: {error.message}</p>;
  }

  const asOf = new Date();
  const rows = (assets ?? []).map((asset) => ({
    asset,
    depreciation: computeStraightLineDepreciation(
      {
        purchaseDate: asset.purchase_date,
        purchaseCost: asset.purchase_cost,
        usefulLifeYears: asset.useful_life_years,
        residualValue: asset.residual_value,
      },
      asOf,
    ),
  }));

  const calculable = rows.filter((r) => r.depreciation !== null);
  const totalPurchaseCost = calculable.reduce((sum, r) => sum + (r.asset.purchase_cost ?? 0), 0);
  const totalAccumulatedDepreciation = calculable.reduce((sum, r) => sum + r.depreciation!.accumulatedDepreciation, 0);
  const totalBookValue = calculable.reduce((sum, r) => sum + r.depreciation!.bookValue, 0);
  const excludedCount = rows.length - calculable.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Asset Depreciation</h1>
          <p className="text-muted-foreground text-sm">
            Straight-line depreciation as of today, for every asset with a purchase date, purchase cost, and useful life
            on file.
          </p>
        </div>
        <Link href="/office/asset-register" className="text-sm underline-offset-2 hover:underline">
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
          <Link href="/office/asset-register/depreciation" className="text-muted-foreground text-sm underline">
            Clear
          </Link>
        )}
      </form>

      <div className="flex flex-wrap gap-4">
        <StatTile label="Purchase cost" value={formatGbp(totalPurchaseCost)} detail={`${calculable.length} asset(s)`} />
        <StatTile label="Accumulated depreciation" value={formatGbp(totalAccumulatedDepreciation)} />
        <StatTile label="Net book value" value={formatGbp(totalBookValue)} />
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 font-medium">Category</th>
            <th className="py-2 font-medium">Item</th>
            <th className="py-2 font-medium">Client</th>
            <th className="py-2 font-medium">Status</th>
            <th className="py-2 font-medium">Purchased</th>
            <th className="py-2 font-medium">Cost</th>
            <th className="py-2 font-medium">Age (yrs)</th>
            <th className="py-2 font-medium">Accumulated dep.</th>
            <th className="py-2 font-medium">Book value</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={9} className="text-muted-foreground py-6 text-center">
                No assets match these filters.
              </td>
            </tr>
          )}
          {rows.map(({ asset, depreciation }) => {
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
                <td className="py-2 tabular-nums">{formatGbp(asset.purchase_cost)}</td>
                {depreciation ? (
                  <>
                    <td className="py-2 tabular-nums">{depreciation.ageYears.toFixed(1)}</td>
                    <td className="py-2 tabular-nums">{formatGbp(depreciation.accumulatedDepreciation)}</td>
                    <td className="py-2 tabular-nums">
                      {formatGbp(depreciation.bookValue)}
                      {depreciation.isFullyDepreciated && (
                        <Badge variant="outline" className="ml-2">
                          Fully depreciated
                        </Badge>
                      )}
                    </td>
                  </>
                ) : (
                  <td colSpan={3} className="text-muted-foreground py-2">
                    Not enough data to calculate — needs purchase date, purchase cost, and useful life.
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {excludedCount > 0 && (
        <p className="text-muted-foreground text-xs">
          {excludedCount} asset(s) above are missing purchase date, purchase cost, or useful life and aren&apos;t included
          in the totals.
        </p>
      )}
    </div>
  );
}
