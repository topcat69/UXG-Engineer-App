import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { humanize } from "@/lib/format/text";
import { AddStockItemForm } from "./add-stock-item-form";
import { AddTestResultForm } from "./add-test-result-form";
import { SoftwareSetupForm } from "./software-setup-form";
import { ClosingChecklistForm } from "./closing-checklist-form";
import { toItem } from "./checklist-item";
import { SignOffPanel } from "./sign-off-panel";

export default async function KioskJobSheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: jobSheet, error: jobSheetError }, { data: stockItems, error: stockItemsError }, { data: testResults }] =
    await Promise.all([
      supabase
        .from("job_sheets")
        .select(
          `id, reference, status, site:sites(name, client:clients(name)),
           cms_name, licence_added, teamviewer_added, added_to_uxg_account, software_notes,
           defects, defects_detail, defects_photo,
           missing_items, missing_items_detail, missing_items_photo,
           packed_correctly, packed_correctly_detail, packed_correctly_photo,
           other_parts_used, other_parts_used_detail, other_parts_used_photo,
           other_issues, other_issues_detail, other_issues_photo,
           work_area_tidy, signed_off_at, signed_off_user:users!job_sheets_signed_off_by_fkey(name)`,
        )
        .eq("id", id)
        .single(),
      supabase
        .from("stock_items")
        .select("id, manufacturer, model, serial_no, firmware_update, tested, damaged, received_at")
        .eq("job_sheet_id", id)
        .order("received_at", { ascending: false }),
      supabase
        .from("job_sheet_tests")
        .select("id, item_description, ir_bud, wifi_cable, tested, outcome, notes")
        .eq("job_sheet_id", id)
        .order("position", { ascending: true }),
    ]);

  if (jobSheetError || !jobSheet) notFound();
  if (stockItemsError) {
    return <p className="text-destructive">Failed to load stock items: {stockItemsError.message}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
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

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Goods-in</h2>
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
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Testing</h2>
        <AddTestResultForm jobSheetId={jobSheet.id} />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>IR bud</TableHead>
              <TableHead>Wifi/cable</TableHead>
              <TableHead>Tested</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(testResults ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground text-center">
                  No test results yet.
                </TableCell>
              </TableRow>
            )}
            {(testResults ?? []).map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.item_description ?? "—"}</TableCell>
                <TableCell>{t.ir_bud ? "Yes" : "No"}</TableCell>
                <TableCell>{t.wifi_cable ?? "—"}</TableCell>
                <TableCell>{t.tested ? "Yes" : "No"}</TableCell>
                <TableCell>{t.outcome ?? "—"}</TableCell>
                <TableCell>{t.notes ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Software / CMS setup</h2>
        <SoftwareSetupForm
          jobSheetId={jobSheet.id}
          cmsName={jobSheet.cms_name}
          licenceAdded={jobSheet.licence_added}
          teamviewerAdded={jobSheet.teamviewer_added}
          addedToUxgAccount={jobSheet.added_to_uxg_account}
          softwareNotes={jobSheet.software_notes}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Closing checklist</h2>
        <ClosingChecklistForm
          jobSheetId={jobSheet.id}
          workAreaTidy={jobSheet.work_area_tidy}
          initial={{
            defects: toItem(jobSheet.defects, jobSheet.defects_detail, jobSheet.defects_photo),
            missingItems: toItem(jobSheet.missing_items, jobSheet.missing_items_detail, jobSheet.missing_items_photo),
            packedCorrectly: toItem(jobSheet.packed_correctly, jobSheet.packed_correctly_detail, jobSheet.packed_correctly_photo),
            otherPartsUsed: toItem(jobSheet.other_parts_used, jobSheet.other_parts_used_detail, jobSheet.other_parts_used_photo),
            otherIssues: toItem(jobSheet.other_issues, jobSheet.other_issues_detail, jobSheet.other_issues_photo),
          }}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Sign-off</h2>
        <SignOffPanel
          jobSheetId={jobSheet.id}
          signedOffByName={jobSheet.signed_off_user?.name ?? null}
          signedOffAt={jobSheet.signed_off_at}
        />
      </section>
    </div>
  );
}
