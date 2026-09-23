import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { humanize } from "@/lib/format/text";
import { AssignToJobForm } from "./assign-to-job-form";
import { StockItemActions } from "./stock-item-actions";
import { DeleteJobSheetButton } from "./delete-job-sheet-button";
import { PoNumberControl } from "./po-number-control";

// Matches the TTL other pages use for their own signed URLs (see e.g.
// office/knowledge-base/[id]/page.tsx) — this page is loaded fresh on every
// visit, so there's no need for anything longer-lived.
const PHOTO_SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Read-only for Office — everything here comes from Warehouse's work in
 * /kiosk (see the Goods-In & Job Sheets proposal's "Who does what": Office
 * creates a sheet and assigns it, it doesn't edit the goods-in/config
 * side). The one thing Office actually does here is assign it to a job.
 */
export default async function JobSheetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: jobSheet, error: jobSheetError }, { data: stockItems }, { data: testResults }] = await Promise.all([
    supabase
      .from("job_sheets")
      .select(
        `id, reference, status, proposed_install_date, job_description, po_number,
         site:sites(id, name, client:clients(name)), project:projects(name),
         cms_name, software_notes,
         defects, missing_items, packed_correctly, other_parts_used, other_issues, work_area_tidy,
         signed_off_at, signed_off_user:users!job_sheets_signed_off_by_fkey(name),
         linked_job:jobs(id, job_number)`,
      )
      .eq("id", id)
      .single(),
    supabase
      .from("stock_items")
      .select("id, manufacturer, model, serial_no, tested, damaged, image_path")
      .eq("job_sheet_id", id)
      .order("received_at", { ascending: false }),
    supabase
      .from("job_sheet_tests")
      .select(
        `id, item_description, wifi_dongle, tested, licence_added, teamviewer_added, philips_wave_added,
         added_to_uxg_account, outcome, stock_item:stock_items(manufacturer, model, serial_no)`,
      )
      .eq("job_sheet_id", id)
      .order("position"),
  ]);

  if (jobSheetError || !jobSheet) notFound();

  const stockItemsWithPhotoUrls = await Promise.all(
    (stockItems ?? []).map(async (item) => {
      if (!item.image_path) return { ...item, imageUrl: null };
      const { data } = await supabase.storage.from("stock-item-photos").createSignedUrl(item.image_path, PHOTO_SIGNED_URL_TTL_SECONDS);
      return { ...item, imageUrl: data?.signedUrl ?? null };
    }),
  );

  const { data: jobsForSite } = jobSheet.site?.id
    ? await supabase
        .from("jobs")
        .select("id, job_number, job_type, status")
        .eq("site_id", jobSheet.site.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  // Other pickable sheets to pull a Stock Item onto (Decision 7) — any
  // sheet but this one, excluding ones already Complete.
  const { data: otherJobSheets } = await supabase
    .from("job_sheets")
    .select("id, reference")
    .neq("id", id)
    .neq("status", "complete")
    .order("reference");

  return (
    <div className="flex flex-col gap-6">
      <Link href="/office/job-sheets" className="text-muted-foreground text-sm underline">
        ← All job sheets
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{jobSheet.reference}</h1>
          <p className="text-muted-foreground text-sm">
            {jobSheet.site?.client?.name ?? "—"} · {jobSheet.site?.name ?? "—"} · {jobSheet.project?.name ?? "—"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{humanize(jobSheet.status)}</Badge>
          <DeleteJobSheetButton jobSheetId={jobSheet.id} reference={jobSheet.reference} />
        </div>
      </div>

      {jobSheet.job_description && <p className="text-sm">{jobSheet.job_description}</p>}

      <PoNumberControl jobSheetId={jobSheet.id} value={jobSheet.po_number} />

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Stock ({(stockItems ?? []).length})</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Manufacturer</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Serial no.</TableHead>
              <TableHead>Tested</TableHead>
              <TableHead>Damaged</TableHead>
              <TableHead>Photo</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stockItemsWithPhotoUrls.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground text-center">
                  Nothing received yet.
                </TableCell>
              </TableRow>
            )}
            {stockItemsWithPhotoUrls.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.manufacturer ?? "—"}</TableCell>
                <TableCell>{item.model ?? "—"}</TableCell>
                <TableCell>{item.serial_no ?? "—"}</TableCell>
                <TableCell>{item.tested ? "Yes" : "No"}</TableCell>
                <TableCell>{item.damaged ? <Badge variant="destructive">Damaged</Badge> : "No"}</TableCell>
                <TableCell>
                  {item.imageUrl ? (
                    <a href={item.imageUrl} target="_blank" rel="noreferrer" className="text-sm underline-offset-2 hover:underline">
                      View
                    </a>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <StockItemActions stockItemId={item.id} currentJobSheetId={jobSheet.id} otherJobSheets={otherJobSheets ?? []} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Configuration ({(testResults ?? []).length})</h2>
        {(testResults ?? []).length === 0 ? (
          <p className="text-muted-foreground text-sm">Nothing to configure yet.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {(testResults ?? []).map((t) => {
              const label = t.stock_item
                ? [t.stock_item.manufacturer, t.stock_item.model].filter(Boolean).join(" ") +
                  (t.stock_item.serial_no ? ` — ${t.stock_item.serial_no}` : "")
                : t.item_description ?? "—";
              const done = [
                t.licence_added && "Licence",
                t.teamviewer_added && "TeamViewer",
                t.philips_wave_added && "Philips Wave",
                t.added_to_uxg_account && "UXG account",
              ].filter(Boolean);
              return (
                <li key={t.id}>
                  {label || "—"} — {t.tested ? "Tested" : "Not tested"}
                  {t.wifi_dongle ? ` · Wi-Fi Dongle: ${humanize(t.wifi_dongle)}` : ""}
                  {done.length > 0 ? ` · ${done.join(", ")}` : ""}
                  {t.outcome ? ` · Pass: ${humanize(t.outcome)}` : ""}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Software / CMS setup</h2>
        <p className="text-sm">{jobSheet.cms_name ?? "No CMS set"}</p>
        {jobSheet.software_notes && <p className="text-muted-foreground text-sm">{jobSheet.software_notes}</p>}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Closing checklist</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          {jobSheet.defects && <Badge variant="destructive">Defects</Badge>}
          {jobSheet.missing_items && <Badge variant="destructive">Missing items</Badge>}
          {jobSheet.other_parts_used && <Badge variant="outline">Other parts used</Badge>}
          {jobSheet.other_issues && <Badge variant="destructive">Other issues</Badge>}
          <Badge variant={jobSheet.packed_correctly ? "secondary" : "outline"}>
            {jobSheet.packed_correctly ? "Packed correctly" : "Packing not confirmed"}
          </Badge>
          <Badge variant={jobSheet.work_area_tidy ? "secondary" : "outline"}>
            {jobSheet.work_area_tidy ? "Work area tidy" : "Tidy not confirmed"}
          </Badge>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Sign-off</h2>
        {jobSheet.signed_off_user?.name && jobSheet.signed_off_at ? (
          <p className="text-sm">
            Signed off by <span className="font-medium">{jobSheet.signed_off_user.name}</span> on{" "}
            {new Date(jobSheet.signed_off_at).toLocaleString()}
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">Not signed off yet.</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Assign to a job</h2>
        {jobSheet.linked_job && (
          <p className="text-sm">
            Currently assigned to{" "}
            <Link href={`/office/jobs/${jobSheet.linked_job.id}`} className="underline-offset-2 hover:underline">
              {jobSheet.linked_job.job_number}
            </Link>
            .
          </p>
        )}
        <AssignToJobForm jobSheetId={jobSheet.id} jobs={jobsForSite ?? []} />
      </section>
    </div>
  );
}
