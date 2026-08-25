"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseSitesCsv } from "@/lib/csv/sites";
import { geocodePostcode } from "@/lib/geo/postcode";
import { nextJobNumber } from "@/lib/jobs/job-number";
import { maxJobSequenceForYear } from "@/lib/jobs/next-job-number";

export type ImportSitesResult =
  | { ok: true; message: string; siteIds: string[] }
  | { ok: false; message: string };

export async function importSitesCsv(formData: FormData): Promise<ImportSitesResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a CSV file first." };
  }
  const clientId = formData.get("clientId");
  if (typeof clientId !== "string" || !clientId) {
    return { ok: false, message: "Select a client first — every site belongs to one." };
  }

  const text = await file.text();
  const { rows, errors } = parseSitesCsv(text);

  if (rows.length === 0) {
    return { ok: false, message: errors[0] ?? "No valid rows found." };
  }

  // A whole CSV batch is one client's sites (e.g. FootAsylum's 200 stores in
  // one file) — client_id isn't a column in the CSV itself, see sites.ts.
  //
  // Rows with no latitude/longitude columns (the common case — most CSVs
  // only ever had address/postcode) get geocoded here, same as the manual
  // "New site" form's createSiteForClient already does. Without this, a
  // site imported this way was saved with no coordinates at all: invisible
  // on the dashboard map, and with nothing for the field app's
  // Start Travelling/Check In location fallback to fall back to either —
  // see DECISIONS.md.
  const rowsWithClient: ((typeof rows)[number] & { client_id: string })[] = [];
  for (const row of rows) {
    let { latitude, longitude } = row;
    if (latitude == null && longitude == null && row.postcode) {
      const coords = await geocodePostcode(row.postcode);
      if (coords) {
        latitude = coords.latitude;
        longitude = coords.longitude;
      }
    }
    rowsWithClient.push({ ...row, latitude, longitude, client_id: clientId });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("sites").insert(rowsWithClient).select("id");
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/import");

  const suffix = errors.length > 0 ? ` (${errors.length} row(s) skipped: ${errors.slice(0, 3).join("; ")})` : "";
  return { ok: true, message: `Imported ${data.length} site(s).${suffix}`, siteIds: data.map((d) => d.id) };
}

export type GenerateJobsResult = { ok: true; message: string } | { ok: false; message: string };

export async function generateJobs(
  siteIds: string[],
  projectId: string,
  jobType: string,
): Promise<GenerateJobsResult> {
  if (siteIds.length === 0) return { ok: false, message: "No sites selected." };
  if (!projectId) return { ok: false, message: "Select a project." };
  if (!jobType) return { ok: false, message: "Select a job type." };

  const supabase = await createClient();
  const year = new Date().getFullYear();
  const maxSeq = await maxJobSequenceForYear(supabase, year);

  const rows = siteIds.map((siteId, i) => ({
    job_number: nextJobNumber(maxSeq, year, i + 1),
    project_id: projectId,
    site_id: siteId,
    job_type: jobType,
    status: "draft" as const,
  }));

  const { error } = await supabase.from("jobs").insert(rows);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/jobs");
  return { ok: true, message: `Generated ${rows.length} job(s).` };
}
