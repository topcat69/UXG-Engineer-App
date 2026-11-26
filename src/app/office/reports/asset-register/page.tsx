import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/office/stat-tile";
import { createClient } from "@/lib/supabase/server";
import { fetchAllSites } from "@/lib/sites/fetch-all-sites";
import { fetchAssetRegisterReportData, ALL_ASSET_STATUSES } from "@/lib/reports/asset-register-data";
import { formatGbp } from "@/lib/format/currency";
import { humanize } from "@/lib/format/text";

type SearchParams = Record<string, string | string[] | undefined>;

function param(sp: SearchParams, key: string): string {
  const value = sp[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

/**
 * Asset Register report — Report Generator, built on the same pattern as
 * the SLA Compliance / Project Rollup reports: query + aggregation lives
 * in lib/reports/asset-register-data.ts, shared by this page and every
 * export format, so none of them can ever show a different number than
 * the others. Unlike those two, no scope is required to run it — leaving
 * every filter blank reports on the whole register, same as the existing
 * Financial/Warranty/Depreciation sub-pages already do.
 *
 * Deliberately separate from those three: this is a cross-filter overview
 * (what's out there, by customer/site/category/status) with export, not a
 * procurement/warranty/depreciation deep-dive — see the Report Generator
 * scoping decision that kept Asset Register's existing report sub-pages
 * (and Finance's reuse of them) untouched and out of scope for this.
 */
export default async function AssetRegisterReportPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const clientId = param(sp, "client_id");
  const siteId = param(sp, "site_id");
  const categoryId = param(sp, "category_id");
  const status = param(sp, "status");

  const supabase = await createClient();

  const [{ data: clients }, allSites, { data: categories }, { data: sitesForClient }] = await Promise.all([
    supabase.from("clients").select("id, name").order("name"),
    clientId ? Promise.resolve([]) : fetchAllSites(supabase),
    supabase.from("asset_categories").select("id, name").order("name"),
    clientId ? supabase.from("sites").select("id, name").eq("client_id", clientId).order("name") : Promise.resolve({ data: null }),
  ]);

  const sitesForFilter = clientId ? (sitesForClient ?? []) : allSites;

  const result = await fetchAssetRegisterReportData(supabase, { clientId, siteId, categoryId, status });

  if (!result.ok) {
    return <p className="text-destructive">Failed to load the Asset Register report: {result.message}</p>;
  }

  const { totalAssets, statusCounts, categoryBreakdown, totalPurchaseCost, costedCount, rows } = result.data;
  const hasFilters = !!(clientId || siteId || categoryId || status);
  const exportParams = new URLSearchParams({
    ...(clientId && { client_id: clientId }),
    ...(siteId && { site_id: siteId }),
    ...(categoryId && { category_id: categoryId }),
    ...(status && { status }),
  }).toString();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Asset Register Report</h1>
          <p className="text-muted-foreground text-sm">
            Every asset on file, filterable by customer, site, category and status, with export.
          </p>
        </div>
        <div className="flex gap-3 text-sm whitespace-nowrap">
          <Link href="/office/report-generator" className="underline-offset-2 hover:underline">
            Report Generator
          </Link>
          <Link href="/office/asset-register" className="underline-offset-2 hover:underline">
            Asset Register
          </Link>
        </div>
      </div>

      <form className="flex flex-wrap items-end gap-2" method="get">
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs" htmlFor="client_id">
            Customer
          </label>
          <select id="client_id" name="client_id" defaultValue={clientId} className="border-input h-9 rounded-md border bg-transparent px-3 text-sm">
            <option value="">All</option>
            {(clients ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs" htmlFor="site_id">
            Site
          </label>
          <select id="site_id" name="site_id" defaultValue={siteId} className="border-input h-9 rounded-md border bg-transparent px-3 text-sm">
            <option value="">All</option>
            {sitesForFilter.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs" htmlFor="category_id">
            Category
          </label>
          <select id="category_id" name="category_id" defaultValue={categoryId} className="border-input h-9 rounded-md border bg-transparent px-3 text-sm">
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
          <select id="status" name="status" defaultValue={status} className="border-input h-9 rounded-md border bg-transparent px-3 text-sm">
            <option value="">All</option>
            {ALL_ASSET_STATUSES.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="border-input h-9 rounded-md border px-4 text-sm hover:bg-accent">
          Filter
        </button>
        {hasFilters && (
          <Link href="/office/reports/asset-register" className="text-muted-foreground text-sm underline">
            Clear
          </Link>
        )}
      </form>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-muted-foreground">Export this view:</span>
        <a href={`/api/reports/asset-register/pdf?${exportParams}`} className="border-input rounded-md border px-3 py-1.5 hover:bg-accent">
          PDF
        </a>
        <a href={`/api/reports/asset-register/xlsx?${exportParams}`} className="border-input rounded-md border px-3 py-1.5 hover:bg-accent">
          Excel
        </a>
        <a href={`/api/reports/asset-register/csv?${exportParams}`} className="border-input rounded-md border px-3 py-1.5 hover:bg-accent">
          CSV
        </a>
        <a href={`/api/reports/asset-register/zip?${exportParams}`} className="border-input rounded-md border px-3 py-1.5 hover:bg-accent">
          Zip (all formats)
        </a>
      </div>

      <div className="flex flex-wrap gap-4">
        <StatTile label="Total assets" value={String(totalAssets)} />
        <StatTile label="Total purchase cost" value={formatGbp(totalPurchaseCost)} detail={`${costedCount} of ${totalAssets} asset(s) costed`} />
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold">By status</h2>
        <div className="flex flex-wrap gap-2">
          {statusCounts.map((s) => (
            <Badge key={s.status} variant="secondary">
              {s.label}: {s.count}
            </Badge>
          ))}
          {statusCounts.length === 0 && <span className="text-muted-foreground text-sm">No assets in scope.</span>}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold">By category</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 font-medium">Category</th>
                <th className="py-2 font-medium">Assets</th>
              </tr>
            </thead>
            <tbody>
              {categoryBreakdown.length === 0 && (
                <tr>
                  <td colSpan={2} className="text-muted-foreground py-4 text-center">
                    No assets match these filters.
                  </td>
                </tr>
              )}
              {categoryBreakdown.map((c) => (
                <tr key={c.label} className="border-b">
                  <td className="py-2">{c.label}</td>
                  <td className="py-2 tabular-nums">{c.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold">Assets</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 font-medium">Item</th>
                <th className="py-2 font-medium">Category</th>
                <th className="py-2 font-medium">Customer</th>
                <th className="py-2 font-medium">Site</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 font-medium">Install date</th>
                <th className="py-2 font-medium">Purchase cost</th>
                <th className="py-2 font-medium">Warranty end</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-muted-foreground py-6 text-center">
                    No assets match these filters.
                  </td>
                </tr>
              )}
              {rows.map((asset) => (
                <tr key={asset.id} className="border-b">
                  <td className="py-2">
                    {asset.itemLabel}
                    {asset.serialNumber ? <span className="text-muted-foreground"> — {asset.serialNumber}</span> : null}
                  </td>
                  <td className="py-2 text-muted-foreground">{asset.categoryName ?? "—"}</td>
                  <td className="py-2 text-muted-foreground">{asset.clientName ?? "—"}</td>
                  <td className="py-2 text-muted-foreground">{asset.siteName ?? "—"}</td>
                  <td className="py-2">
                    <Badge variant="secondary">{humanize(asset.status)}</Badge>
                  </td>
                  <td className="py-2 text-muted-foreground">{asset.installDate ?? "—"}</td>
                  <td className="py-2 tabular-nums">{formatGbp(asset.purchaseCost)}</td>
                  <td className="py-2 text-muted-foreground">{asset.warrantyEnd ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
