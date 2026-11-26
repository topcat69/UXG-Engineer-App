import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { humanize } from "@/lib/format/text";

type AnySupabaseClient = SupabaseClient<Database>;
type AssetStatus = Database["public"]["Enums"]["asset_status"];

export const ALL_ASSET_STATUSES: AssetStatus[] = ["spare", "in_use", "faulty", "in_repair", "retired"];

export type AssetRegisterReportFilters = {
  clientId: string;
  siteId: string;
  categoryId: string;
  status: string;
};

export type AssetRegisterAssetRow = {
  id: string;
  itemLabel: string;
  serialNumber: string | null;
  categoryName: string | null;
  siteName: string | null;
  clientName: string | null;
  status: AssetStatus;
  installDate: string | null;
  purchaseDate: string | null;
  purchaseCost: number | null;
  warrantyEnd: string | null;
};

export type AssetRegisterReportData = {
  filters: AssetRegisterReportFilters;
  totalAssets: number;
  statusCounts: { status: AssetStatus; label: string; count: number }[];
  categoryBreakdown: { label: string; count: number }[];
  totalPurchaseCost: number;
  costedCount: number;
  rows: AssetRegisterAssetRow[];
};

export type AssetRegisterReportResult = { ok: true; data: AssetRegisterReportData } | { ok: false; message: string };

/**
 * The Asset Register report's own query + aggregation, pulled out of the
 * page so the on-screen report and every export format run from exactly
 * one query — same split as project-rollup-data.ts/sla-compliance-data.ts.
 * Unlike those two, there's no mandatory scope here: no filter set means
 * "every asset", matching how the existing Financial/Warranty/Depreciation
 * sub-pages already behave.
 *
 * `asset_register` has no `client_id` column of its own (it's site-scoped,
 * same as everywhere else in the app) — a Customer filter resolves to that
 * client's site ids first, then filters on `site_id`, same two-step
 * resolution project-rollup-data.ts uses for its client->project scope.
 */
export async function fetchAssetRegisterReportData(
  supabase: AnySupabaseClient,
  filters: AssetRegisterReportFilters,
): Promise<AssetRegisterReportResult> {
  const { clientId, siteId, categoryId, status } = filters;

  let siteIds: string[] | null = null;
  if (clientId) {
    const { data: clientSites, error: siteErr } = await supabase.from("sites").select("id").eq("client_id", clientId);
    if (siteErr) return { ok: false, message: siteErr.message };
    siteIds = (clientSites ?? []).map((s) => s.id);
    if (siteIds.length === 0) siteIds = ["00000000-0000-0000-0000-000000000000"];
  }

  let query = supabase
    .from("asset_register")
    .select(
      `id, manufacturer, model, serial_number, status, install_date, purchase_date, purchase_cost, warranty_end,
       category:asset_categories(name), site:sites(name, client:clients(name))`,
    )
    .order("created_at", { ascending: false });
  if (siteId) query = query.eq("site_id", siteId);
  else if (siteIds) query = query.in("site_id", siteIds);
  if (categoryId) query = query.eq("category_id", categoryId);
  if (status) query = query.eq("status", status as AssetStatus);

  const { data: assets, error } = await query;
  if (error) return { ok: false, message: error.message };

  const rows = assets ?? [];

  const statusCountsMap = new Map<AssetStatus, number>();
  for (const r of rows) statusCountsMap.set(r.status, (statusCountsMap.get(r.status) ?? 0) + 1);
  const statusCounts = ALL_ASSET_STATUSES.filter((s) => (statusCountsMap.get(s) ?? 0) > 0).map((s) => ({
    status: s,
    label: humanize(s),
    count: statusCountsMap.get(s) ?? 0,
  }));

  const categoryCountsMap = new Map<string, number>();
  for (const r of rows) {
    const label = r.category?.name ?? "Uncategorised";
    categoryCountsMap.set(label, (categoryCountsMap.get(label) ?? 0) + 1);
  }
  const categoryBreakdown = Array.from(categoryCountsMap.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  const withCost = rows.filter((r) => r.purchase_cost != null);
  const totalPurchaseCost = withCost.reduce((sum, r) => sum + (r.purchase_cost ?? 0), 0);

  const assetRows: AssetRegisterAssetRow[] = rows.map((asset) => ({
    id: asset.id,
    itemLabel: [asset.manufacturer, asset.model].filter(Boolean).join(" ") || "—",
    serialNumber: asset.serial_number,
    categoryName: asset.category?.name ?? null,
    siteName: asset.site?.name ?? null,
    clientName: asset.site?.client?.name ?? null,
    status: asset.status,
    installDate: asset.install_date,
    purchaseDate: asset.purchase_date,
    purchaseCost: asset.purchase_cost,
    warrantyEnd: asset.warranty_end,
  }));

  return {
    ok: true,
    data: {
      filters,
      totalAssets: rows.length,
      statusCounts,
      categoryBreakdown,
      totalPurchaseCost,
      costedCount: withCost.length,
      rows: assetRows,
    },
  };
}
