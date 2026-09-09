import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { humanize } from "@/lib/format/text";

/**
 * Every non-Complete Job Sheet is pickable here, not just Building/
 * Receiving ones — Decision 7 in the Goods-In & Job Sheets proposal is
 * explicit that stages don't lock each other out, since a late unit can
 * turn up after Configuring has already started.
 */
export default async function KioskHomePage() {
  const supabase = await createClient();

  const { data: jobSheets, error } = await supabase
    .from("job_sheets")
    .select("id, reference, status, site:sites(name, client:clients(name))")
    .neq("status", "complete")
    .order("created_at", { ascending: false });

  if (error) {
    return <p className="text-destructive">Failed to load job sheets: {error.message}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Goods-In</h1>
        <p className="text-muted-foreground text-sm">Pick a job sheet to scan or add stock onto.</p>
      </div>

      {(jobSheets ?? []).length === 0 && (
        <p className="text-muted-foreground text-sm">
          No job sheets waiting on stock — ask the office to create one from Job Sheets.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {(jobSheets ?? []).map((jobSheet) => (
          <li key={jobSheet.id}>
            <Link
              href={`/kiosk/${jobSheet.id}`}
              className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/40"
            >
              <div>
                <p className="font-medium">{jobSheet.reference}</p>
                <p className="text-muted-foreground text-sm">
                  {jobSheet.site?.client?.name ?? "—"} · {jobSheet.site?.name ?? "—"}
                </p>
              </div>
              <Badge variant="secondary">{humanize(jobSheet.status)}</Badge>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
