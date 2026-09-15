import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/office/stat-tile";
import { createClient } from "@/lib/supabase/server";
import { classifyWarrantyStatus, type WarrantyStatus } from "@/lib/asset-register/warranty";
import { humanize } from "@/lib/format/text";
import type { Database } from "@/lib/supabase/database.types";

type AssetStatus = Database["public"]["Enums"]["asset_status"];
const ASSET_STATUSES: AssetStatus[] = ["spare", "in_use", "faulty", "in_repair", "retired"];

const WARRANTY_STATUS_LABELS: Record<WarrantyStatus, string> = {
  no_warranty: "No warranty on file",
  expired: "Expired",
  expiring_soon: "Expiring soon",
  active: "Active",
};

export type WarrantySearchParams = { category_id?: string; status?: string; warranty_status?: string };

function isWarrantyStatus(value: string): value is WarrantyStatus {
  return value in WARRANTY_STATUS_LABELS;
}

/**
 * Every warranty/support field entered on an asset, in one table, sorted
 * by whichever expires soonest — today the only way to see these is to
 * open each asset's Edit form one at a time. "Expiring soon" is 90 days
 * out (see classifyWarrantyStatus) — enough lead time to renew or budget
 * for a replacement before cover actually lapses.
 *
 * Shared between /office/asset-register/warranty (manager/superadmin)
 * and /finance/warranty (finance/superadmin) — basePath supplies the
 * "back" and "clear filters" links for whichever surface rendered it.
 */
export async function AssetWarrantyReport({
  searchParams,
  basePath,
}: {
  searchParams: Promise<WarrantySearchParams>;
  basePath: string;
}) {
  const { category_id: categoryId = "", status = "", warranty_status: warrantyStatusFilter = "" } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("asset_register")
    .select(
      `id, manufacturer, model, serial_number, status, warranty_start, warranty_end, warranty_provider,
       support_contract_ref, support_sla,
       category:asset_categories(name), site:sites(name, client:clients(name))`,
    )
    .order("warranty_end", { ascending: true, nullsFirst: false });
  if (categoryId) query = query.eq("category_id", categoryId);
  if (status) query = query.eq("status", status as AssetStatus);

  const [{ data: assets, error }, { data: categories }] = await Promise.all([
    query,
    supabase.from("asset_categories").select("id, name").order("name"),
  ]);

  if (error) {
    return <p className="text-destructive">Failed to load the warranty report: {error.message}</p>;
  }

  const asOf = new Date();
  const allRows = (assets ?? []).map((asset) => ({ asset, warrantyStatus: classifyWarrantyStatus(asset.warranty_end, asOf) }));
  const rows = isWarrantyStatus(warrantyStatusFilter) ? allRows.filter((r) => r.warrantyStatus === warrantyStatusFilter) : allRows;

  const expiringSoonCount = allRows.filter((r) => r.warrantyStatus === "expiring_soon").length;
  const expiredCount = allRows.filter((r) => r.warrantyStatus === "expired").length;
  const noWarrantyCount = allRows.filter((r) => r.warrantyStatus === "no_warranty").length;

  const hasAnyFilter = categoryId || status || warrantyStatusFilter;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Asset Warranty Report</h1>
          <p className="text-muted-foreground text-sm">
            Warranty and support details on file for every asset, soonest expiry first.
          </p>
        </div>
        <Link href={basePath} className="text-sm whitespace-nowrap underline-offset-2 hover:underline">
          Back to Asset Register
        </Link>
      </div>

      <form className="flex flex-wrap items-end gap-2" method="get">
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs" htmlFor="warranty_status">
            Warranty status
          </label>
          <select
            id="warranty_status"
            name="warranty_status"
            defaultValue={warrantyStatusFilter}
            className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            <option value="">All</option>
            {(Object.keys(WARRANTY_STATUS_LABELS) as WarrantyStatus[]).map((s) => (
              <option key={s} value={s}>
                {WARRANTY_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
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
        {hasAnyFilter && (
          <Link href={`${basePath}/warranty`} className="text-muted-foreground text-sm underline">
            Clear
          </Link>
        )}
      </form>

      <div className="flex flex-wrap gap-4">
        <StatTile label="Expiring soon" value={String(expiringSoonCount)} detail="within 90 days" />
        <StatTile label="Expired" value={String(expiredCount)} />
        <StatTile label="No warranty on file" value={String(noWarrantyCount)} detail={`of ${allRows.length} asset(s)`} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 font-medium">Category</th>
              <th className="py-2 font-medium">Item</th>
              <th className="py-2 font-medium">Client</th>
              <th className="py-2 font-medium">Status</th>
              <th className="py-2 font-medium">Warranty start</th>
              <th className="py-2 font-medium">Warranty end</th>
              <th className="py-2 font-medium">Provider</th>
              <th className="py-2 font-medium">Support contract ref</th>
              <th className="py-2 font-medium">Support SLA</th>
              <th className="py-2 font-medium">Warranty status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="text-muted-foreground py-6 text-center">
                  No assets match these filters.
                </td>
              </tr>
            )}
            {rows.map(({ asset, warrantyStatus }) => {
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
                  <td className="py-2 text-muted-foreground">{asset.warranty_start ?? "—"}</td>
                  <td className="py-2 text-muted-foreground">{asset.warranty_end ?? "—"}</td>
                  <td className="py-2 text-muted-foreground">{asset.warranty_provider ?? "—"}</td>
                  <td className="py-2 text-muted-foreground">{asset.support_contract_ref ?? "—"}</td>
                  <td className="py-2 text-muted-foreground">{asset.support_sla ?? "—"}</td>
                  <td className="py-2">
                    {warrantyStatus === "no_warranty" ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <Badge
                        variant={warrantyStatus === "expired" ? "destructive" : warrantyStatus === "expiring_soon" ? "outline" : "secondary"}
                      >
                        {WARRANTY_STATUS_LABELS[warrantyStatus]}
                      </Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
