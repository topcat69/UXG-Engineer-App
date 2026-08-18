"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseSitesCsv } from "@/lib/csv/sites";
import { nextJobNumber } from "@/lib/jobs/job-number";

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
  const rowsWithClient = rows.map((row) => ({ ...row, client_id: clientId }));

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
  const { count } = await supabase.from("jobs").select("id", { count: "exact", head: true });
  const year = new Date().getFullYear();

  const rows = siteIds.map((siteId, i) => ({
    job_number: nextJobNumber(count ?? 0, year, i + 1),
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
