import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { humanize } from "@/lib/format/text";
import { CreateJobSheetForm } from "./create-job-sheet-form";

const PAGE_SIZE = 50;

/**
 * List + creation, plus a link into each sheet's own detail page (see
 * [id]/page.tsx) — that's where Office reviews a Ready sheet and assigns
 * it to a job. Warehouse's scanning/configuring stages live entirely in
 * /kiosk; nothing here edits that side.
 */
export default async function JobSheetsPage() {
  const supabase = await createClient();

  const [{ data: jobSheets, count, error }, { data: projects }, { data: sites }] = await Promise.all([
    supabase
      .from("job_sheets")
      .select(
        `id, reference, status, proposed_install_date, created_at,
         site:sites(name, client:clients(name)), project:projects(name),
         linked_job:jobs(id, job_number)`,
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(0, PAGE_SIZE - 1),
    supabase.from("projects").select("id, name, client_id").order("name"),
    supabase.from("sites").select("id, name, client_id").order("name"),
  ]);

  if (error) {
    return <p className="text-destructive">Failed to load job sheets: {error.message}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Job Sheets</h1>
          <p className="text-muted-foreground text-sm">
            Prepared kit for an install — goods-in, configuration and sign-off happen on the same sheet before it&apos;s assigned
            to a job.
          </p>
        </div>
        <span className="text-muted-foreground text-sm">{count ?? 0} total</span>
      </div>

      <CreateJobSheetForm projects={projects ?? []} sites={sites ?? []} />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ref</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Site</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Job</TableHead>
            <TableHead>Proposed install</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(jobSheets ?? []).length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-muted-foreground text-center">
                No job sheets yet.
              </TableCell>
            </TableRow>
          )}
          {(jobSheets ?? []).map((jobSheet) => (
            <TableRow key={jobSheet.id}>
              <TableCell>
                <Link href={`/office/job-sheets/${jobSheet.id}`} className="font-medium underline-offset-2 hover:underline">
                  {jobSheet.reference}
                </Link>
              </TableCell>
              <TableCell>{jobSheet.site?.client?.name ?? "—"}</TableCell>
              <TableCell>{jobSheet.site?.name ?? "—"}</TableCell>
              <TableCell>{jobSheet.project?.name ?? "—"}</TableCell>
              <TableCell>
                <Badge variant="secondary">{humanize(jobSheet.status)}</Badge>
              </TableCell>
              <TableCell>
                {jobSheet.linked_job ? (
                  <Link href={`/office/jobs/${jobSheet.linked_job.id}`} className="underline-offset-2 hover:underline">
                    {jobSheet.linked_job.job_number}
                  </Link>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>
                {jobSheet.proposed_install_date ? new Date(jobSheet.proposed_install_date).toLocaleDateString() : "—"}
              </TableCell>
              <TableCell>{jobSheet.created_at ? new Date(jobSheet.created_at).toLocaleDateString() : "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
