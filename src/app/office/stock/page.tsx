import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { humanize } from "@/lib/format/text";
import { groupEarmarkedStock, groupShelfStock, type EarmarkedStockRow, type ShelfStockRow } from "@/lib/stock/aggregate-stock";
import { AddShelfStockForm } from "./add-shelf-stock-form";
import { AllocateStockControl } from "./allocate-stock-control";

/**
 * Everything that's come through goods-in, in one place — see the
 * approved mockup. Two groupings of the same stock_items table (see
 * 20260910010000_stock_items_nullable_job_sheet.sql): earmarked rows
 * have a job_sheet_id, shelf rows don't. Totals only, not individual
 * items, per the product decision behind this page.
 */
export default async function StockPage() {
  const supabase = await createClient();

  const [{ data: earmarkedRaw, error: earmarkedError }, { data: shelfRaw, error: shelfError }, { data: jobSheets }, { data: manufacturers }, { data: models }] =
    await Promise.all([
      supabase
        .from("stock_items")
        .select(
          `manufacturer, model,
           job_sheet:job_sheets!inner(id, reference, status, site:sites(name), linked_job:jobs(job_number))`,
        )
        .not("job_sheet_id", "is", null),
      supabase.from("stock_items").select("manufacturer, model").is("job_sheet_id", null),
      supabase.from("job_sheets").select("id, reference").neq("status", "complete").order("reference"),
      supabase.from("stock_manufacturers").select("id, name").order("name"),
      supabase.from("stock_models").select("id, name, manufacturer_id").order("name"),
    ]);

  if (earmarkedError) return <p className="text-destructive">Failed to load stock: {earmarkedError.message}</p>;
  if (shelfError) return <p className="text-destructive">Failed to load stock: {shelfError.message}</p>;

  const earmarkedRows: EarmarkedStockRow[] = (earmarkedRaw ?? []).map((r) => ({
    manufacturer: r.manufacturer,
    model: r.model,
    jobSheetId: r.job_sheet.id,
    jobSheetReference: r.job_sheet.reference,
    jobSheetStatus: r.job_sheet.status,
    jobNumber: r.job_sheet.linked_job?.job_number ?? null,
    siteName: r.job_sheet.site?.name ?? null,
  }));
  const shelfRows: ShelfStockRow[] = (shelfRaw ?? []).map((r) => ({ manufacturer: r.manufacturer, model: r.model }));

  const earmarkedGroups = groupEarmarkedStock(earmarkedRows);
  const shelfGroups = groupShelfStock(shelfRows);

  const totalEarmarked = earmarkedGroups.reduce((sum, g) => sum + g.quantity, 0);
  const totalShelf = shelfGroups.reduce((sum, g) => sum + g.quantity, 0);
  const openJobSheetCount = new Set(earmarkedGroups.map((g) => g.jobSheetId)).size;
  const distinctItemCount = new Set(
    [...earmarkedGroups, ...shelfGroups].map((g) => `${g.manufacturer ?? ""} ${g.model ?? ""}`),
  ).size;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Stock</h1>
        <p className="text-muted-foreground text-sm">
          Everything that&apos;s come through goods-in, in one place — what&apos;s earmarked for a job, and what&apos;s still
          sitting on the shelf.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Units earmarked for jobs" value={totalEarmarked} detail={`across ${openJobSheetCount} open job sheets`} />
        <StatTile label="Units on the shelf" value={totalShelf} detail="unallocated, ready to assign" />
        <StatTile label="Distinct items tracked" value={distinctItemCount} detail="manufacturer + model combinations" />
      </div>

      <section className="flex flex-col gap-2">
        <div>
          <h2 className="font-medium">Earmarked for jobs</h2>
          <p className="text-muted-foreground text-sm">Stock received against a Job Sheet, grouped by item and the job it&apos;s going to.</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Job</TableHead>
              <TableHead>Job sheet status</TableHead>
              <TableHead className="text-right">Qty</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {earmarkedGroups.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground text-center">
                  Nothing earmarked yet.
                </TableCell>
              </TableRow>
            )}
            {earmarkedGroups.map((g) => (
              <TableRow key={`${g.manufacturer}-${g.model}-${g.jobSheetId}`}>
                <TableCell>
                  {g.manufacturer ?? "—"} {g.model ?? ""}
                </TableCell>
                <TableCell>
                  <Link href={`/office/job-sheets/${g.jobSheetId}`} className="underline-offset-2 hover:underline">
                    {g.jobSheetReference}
                  </Link>
                  {g.jobNumber && <span className="text-muted-foreground"> · {g.jobNumber}</span>}
                  {g.siteName && <div className="text-muted-foreground text-xs">{g.siteName}</div>}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{humanize(g.jobSheetStatus)}</Badge>
                </TableCell>
                <TableCell className="text-right font-medium">{g.quantity}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-medium">On the shelf</h2>
            <p className="text-muted-foreground text-sm">Stock not yet tied to a job — existing warehouse stock, or anything added manually.</p>
          </div>
        </div>
        <AddShelfStockForm manufacturers={manufacturers ?? []} models={models ?? []} />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Qty on shelf</TableHead>
              <TableHead>Allocate to job</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shelfGroups.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground text-center">
                  Nothing on the shelf.
                </TableCell>
              </TableRow>
            )}
            {shelfGroups.map((g) => (
              <TableRow key={`${g.manufacturer}-${g.model}`}>
                <TableCell>
                  {g.manufacturer ?? "—"} {g.model ?? ""}
                </TableCell>
                <TableCell className="text-right font-medium">{g.quantity}</TableCell>
                <TableCell>
                  <AllocateStockControl
                    manufacturer={g.manufacturer}
                    model={g.model}
                    maxQuantity={g.quantity}
                    jobSheets={jobSheets ?? []}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}

function StatTile({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-md border p-4">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-muted-foreground text-xs">{detail}</p>
    </div>
  );
}
