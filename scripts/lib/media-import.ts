import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { lookupId } from "@/lib/migration/csv-helpers";
import { parseMediaManifestCsv, type MediaManifestRow } from "@/lib/migration/parse-media-manifest";
import type { ScriptAdminClient } from "./supabase-admin";

const MIME_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

const BUCKET = "media";

export type MediaImportSummary = { imported: number; errors: string[] };

/**
 * Uploads every file listed in `<rootDir>/media.csv` into Supabase Storage
 * and creates the matching `media_assets` row, preserving every metadata
 * field the manifest carries (GPS, captured_at, caption, who captured it).
 * This is the part of "copy media from Drive" that's fully real and fully
 * testable in this sandbox: `rootDir` is just a local directory — whether
 * those files got there via a manual copy or via the Drive-download step
 * in migrate-media.ts (which needs real Google credentials this sandbox
 * doesn't have) makes no difference to this function.
 */
export async function importMediaFromManifest(
  rootDir: string,
  supabase: ScriptAdminClient,
  jobLookup: Map<string, string>,
  userLookup: Map<string, string>,
): Promise<MediaImportSummary> {
  const manifestPath = path.join(rootDir, "media.csv");
  if (!fs.existsSync(manifestPath)) {
    return { imported: 0, errors: [`No media.csv found in ${rootDir}`] };
  }

  const { rows, errors: parseErrors } = parseMediaManifestCsv(fs.readFileSync(manifestPath, "utf-8"));
  const errors = [...parseErrors];
  let imported = 0;

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    const result = await importOneFile(rootDir, row, rowNumber, supabase, jobLookup, userLookup);
    if (result) errors.push(result);
    else imported++;
  }

  return { imported, errors };
}

async function importOneFile(
  rootDir: string,
  row: MediaManifestRow,
  rowNumber: number,
  supabase: ScriptAdminClient,
  jobLookup: Map<string, string>,
  userLookup: Map<string, string>,
): Promise<string | null> {
  const jobId = lookupId(jobLookup, row.jobNumber);
  if (!jobId) return `media.csv row ${rowNumber}: unknown job_number "${row.jobNumber}"`;

  const filePath = path.join(rootDir, row.filename);
  if (!fs.existsSync(filePath)) return `media.csv row ${rowNumber}: file not found: ${row.filename}`;

  const bytes = fs.readFileSync(filePath);
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  const ext = row.filename.split(".").pop()?.toLowerCase() ?? "bin";
  const mime = MIME_TYPES[ext] ?? "application/octet-stream";
  // Content-addressed suffix rather than Date.now() (what the live capture
  // flow uses) — deterministic across re-runs, so importing the same
  // export twice overwrites the same object instead of duplicating it.
  const storagePath = `jobs/${jobId}/${row.slot}-${sha256.slice(0, 12)}.${ext}`;
  const capturedAt = row.captured_at ?? fs.statSync(filePath).mtime.toISOString();
  const capturedBy = row.capturedByEmail ? lookupId(userLookup, row.capturedByEmail) : undefined;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType: mime,
    upsert: true,
  });
  if (uploadError) return `media.csv row ${rowNumber}: upload failed for ${row.filename}: ${uploadError.message}`;

  const { error: insertError } = await supabase.from("media_assets").insert({
    job_id: jobId,
    slot: row.slot,
    storage_path: storagePath,
    media_type: row.media_type,
    bytes: bytes.length,
    mime,
    captured_at: capturedAt,
    uploaded_at: new Date().toISOString(),
    latitude: row.latitude,
    longitude: row.longitude,
    sha256,
    captured_by: capturedBy,
    caption: row.caption,
  });
  if (insertError) return `media.csv row ${rowNumber}: media_assets insert failed for ${row.filename}: ${insertError.message}`;

  return null;
}
