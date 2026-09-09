import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { humanize } from "@/lib/format/text";
import { AddStockItemForm } from "./add-stock-item-form";

export default async function KioskJobSheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: jobSheet, error: jobSheetError }, { data: stockItems, error: stockItemsError }] = await Promise.all([
    supabase.from("job_sheets").select("id, reference, status, site:sites(name, client:clients(name))").eq("id", id).single(),
    supabase
      .from("stock_items")
      .select("id, manufacturer, model, serial_no, firmware_update, tested, damaged, received_at")
      .eq("job_sheet_id", id)
      .order("received_at", { ascending: false }),
  ]);

  if (jobSheetError || !jobSheet) notFound();
  if (stockItemsError) {
    return <p className="text-destructive">Failed to load stock items: {stockItemsError.message}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href="/kiosk" className="text-muted-foreground text-sm underline">
        ← All job sheets
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{jobSheet.reference}</h1>
          <p className="text-muted-foreground text-sm">
            {jobSheet.site?.client?.name ?? "—"} · {jobSheet.site?.name ?? "—"}
          </p>
        </div>
        <Badge variant="secondary">{humanize(jobSheet.status)}</Badge>
      </div>

      <AddStockItemForm jobSheetId={jobSheet.id} />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Manufacturer</TableHead>
            <TableHead>Model</TableHead>
            <TableHead>Serial no.</TableHead>
            <TableHead>Firmware</TableHead>
            <TableHead>Tested</TableHead>
            <TableHead>Damaged</TableHead>
            <TableHead>Received</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(stockItems ?? []).length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-muted-foreground text-center">
                Nothing scanned in yet.
              </TableCell>
            </TableRow>
          )}
          {(stockItems ?? []).map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.manufacturer ?? "—"}</TableCell>
              <TableCell>{item.model ?? "—"}</TableCell>
              <TableCell>{item.serial_no ?? "—"}</TableCell>
              <TableCell>{item.firmware_update ?? "—"}</TableCell>
              <TableCell>{item.tested ? "Yes" : "No"}</TableCell>
              <TableCell>{item.damaged ? <Badge variant="destructive">Damaged</Badge> : "No"}</TableCell>
              <TableCell>{item.received_at ? new Date(item.received_at).toLocaleString() : "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
