import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { uploadFile } from "./drive-folders";
import { ensureJobDriveFolder } from "./drive-sync";

type AnySupabaseClient = SupabaseClient<Database>;
type JobDetailsRow = Database["public"]["Tables"]["job_details"]["Row"];

/**
 * media_assets/signatures rows are written straight from the browser to
 * Supabase Storage (see lib/offline/outbox.ts's drainMediaQueue), so
 * unlike the folder-creation calls in drive-sync.ts, these run from a
 * polling cron route (api/cron/drive-media-sync/route.ts) rather than a
 * request that just created the row — there's no such request to hook
 * into. Same best-effort contract throughout: a Drive failure here never
 * throws back to the cron route, which just moves on to the next file
 * and picks this one back up on its next run.
 */
async function downloadStorageFile(supabase: AnySupabaseClient, path: string): Promise<{ content: Buffer; mime: string } | null> {
  const { data, error } = await supabase.storage.from("media").download(path);
  if (error || !data) return null;
  return { content: Buffer.from(await data.arrayBuffer()), mime: data.type || "application/octet-stream" };
}

function driveFileNameFor(storagePath: string, fallback: string): string {
  return storagePath.split("/").pop() || fallback;
}

/**
 * supabase-js never throws on a query error (it returns `{ data: null,
 * error }`), so every query in this file checks `error` explicitly and
 * throws it into the surrounding try/catch below — otherwise a real
 * failure (e.g. a genuinely missing column, as happened in production
 * once already) reads identically to "no row found" and the outer
 * catch's console.error, the only thing that would otherwise surface
 * it, never fires.
 */
export async function syncMediaAssetToDrive(supabase: AnySupabaseClient, mediaAssetId: string): Promise<void> {
  try {
    const { data: asset, error: assetError } = await supabase
      .from("media_assets")
      .select("job_id, slot, storage_path, drive_file_id")
      .eq("id", mediaAssetId)
      .single();
    if (assetError) throw assetError;
    if (!asset || asset.drive_file_id || !asset.job_id) return;

    await ensureJobDriveFolder(supabase, asset.job_id);
    const { data: job, error: jobError } = await supabase.from("jobs").select("drive_folder_id").eq("id", asset.job_id).single();
    if (jobError) throw jobError;
    if (!job?.drive_folder_id) return;

    const downloaded = await downloadStorageFile(supabase, asset.storage_path);
    if (!downloaded) return;

    const name = driveFileNameFor(asset.storage_path, `${asset.slot}-${mediaAssetId}`);
    const fileId = await uploadFile(name, job.drive_folder_id, downloaded.content, downloaded.mime);
    if (!fileId) return;
    const { error: updateError } = await supabase.from("media_assets").update({ drive_file_id: fileId }).eq("id", mediaAssetId);
    if (updateError) throw updateError;
  } catch (error) {
    console.error(`Drive media sync failed for media_asset ${mediaAssetId}`, error);
  }
}

export async function syncSignatureToDrive(supabase: AnySupabaseClient, signatureId: string): Promise<void> {
  try {
    const { data: signature, error: signatureError } = await supabase
      .from("signatures")
      .select("job_id, storage_path, drive_file_id")
      .eq("id", signatureId)
      .single();
    if (signatureError) throw signatureError;
    if (!signature || signature.drive_file_id || !signature.job_id) return;

    await ensureJobDriveFolder(supabase, signature.job_id);
    const { data: job, error: jobError } = await supabase.from("jobs").select("drive_folder_id").eq("id", signature.job_id).single();
    if (jobError) throw jobError;
    if (!job?.drive_folder_id) return;

    const downloaded = await downloadStorageFile(supabase, signature.storage_path);
    if (!downloaded) return;

    const name = driveFileNameFor(signature.storage_path, `signature-${signatureId}`);
    const fileId = await uploadFile(name, job.drive_folder_id, downloaded.content, downloaded.mime);
    if (!fileId) return;
    const { error: updateError } = await supabase.from("signatures").update({ drive_file_id: fileId }).eq("id", signatureId);
    if (updateError) throw updateError;
  } catch (error) {
    console.error(`Drive signature sync failed for signature ${signatureId}`, error);
  }
}

export type JobDocumentKind = "rams" | "site_plan" | "design_pack" | "parking_permit";

/** Same four kinds as DOCUMENT_PATCH_KEYS in office/jobs/[id]/actions.ts's uploadJobDocument — one storage_path/drive_file_id column pair per document. */
const JOB_DOCUMENT_COLUMNS: Record<JobDocumentKind, { storage: keyof JobDetailsRow; drive: keyof JobDetailsRow }> = {
  rams: { storage: "rams_storage_path", drive: "rams_drive_file_id" },
  site_plan: { storage: "site_plan_storage_path", drive: "site_plan_drive_file_id" },
  design_pack: { storage: "design_pack_storage_path", drive: "design_pack_drive_file_id" },
  parking_permit: { storage: "parking_permit_storage_path", drive: "parking_permit_drive_file_id" },
};

/** Typed per-kind patch — Supabase's Update type rejects a computed `{ [key]: value }` object, so this switches on the literal key instead of building one dynamically. */
function driveFileIdPatch(kind: JobDocumentKind, fileId: string): Partial<JobDetailsRow> {
  switch (kind) {
    case "rams":
      return { rams_drive_file_id: fileId };
    case "site_plan":
      return { site_plan_drive_file_id: fileId };
    case "design_pack":
      return { design_pack_drive_file_id: fileId };
    case "parking_permit":
      return { parking_permit_drive_file_id: fileId };
  }
}

export async function syncJobDocumentToDrive(supabase: AnySupabaseClient, jobId: string, kind: JobDocumentKind): Promise<void> {
  try {
    const columns = JOB_DOCUMENT_COLUMNS[kind];
    const { data: details, error: detailsError } = await supabase.from("job_details").select("*").eq("job_id", jobId).maybeSingle();
    if (detailsError) throw detailsError;
    const storagePath = details?.[columns.storage] as string | null | undefined;
    const existingDriveFileId = details?.[columns.drive] as string | null | undefined;
    if (!storagePath || existingDriveFileId) return;

    await ensureJobDriveFolder(supabase, jobId);
    const { data: job, error: jobError } = await supabase.from("jobs").select("drive_folder_id").eq("id", jobId).single();
    if (jobError) throw jobError;
    if (!job?.drive_folder_id) return;

    const downloaded = await downloadStorageFile(supabase, storagePath);
    if (!downloaded) return;

    const name = driveFileNameFor(storagePath, `${kind}-${jobId}`);
    const fileId = await uploadFile(name, job.drive_folder_id, downloaded.content, downloaded.mime);
    if (!fileId) return;
    const { error: updateError } = await supabase.from("job_details").update(driveFileIdPatch(kind, fileId)).eq("job_id", jobId);
    if (updateError) throw updateError;
  } catch (error) {
    console.error(`Drive document sync failed for job ${jobId} (${kind})`, error);
  }
}

/**
 * Mirrors the completion report PDF (generated on QA approval, see
 * generateAndStoreCompletionReport) into its job's Drive folder — the
 * last of the four phases, done last on purpose since a job only has a
 * completion report once it's already closed, by which point its folder
 * has certainly been created by every earlier job-related upload.
 */
export async function syncCompletionReportToDrive(supabase: AnySupabaseClient, jobId: string): Promise<void> {
  try {
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("completion_pdf_url, completion_report_drive_file_id")
      .eq("id", jobId)
      .single();
    if (jobError) throw jobError;
    if (!job || !job.completion_pdf_url || job.completion_report_drive_file_id) return;

    await ensureJobDriveFolder(supabase, jobId);
    const { data: folder, error: folderError } = await supabase.from("jobs").select("drive_folder_id").eq("id", jobId).single();
    if (folderError) throw folderError;
    if (!folder?.drive_folder_id) return;

    const downloaded = await downloadStorageFile(supabase, job.completion_pdf_url);
    if (!downloaded) return;

    const name = driveFileNameFor(job.completion_pdf_url, `completion-report-${jobId}.pdf`);
    const fileId = await uploadFile(name, folder.drive_folder_id, downloaded.content, downloaded.mime);
    if (!fileId) return;
    const { error: updateError } = await supabase.from("jobs").update({ completion_report_drive_file_id: fileId }).eq("id", jobId);
    if (updateError) throw updateError;
  } catch (error) {
    console.error(`Drive completion report sync failed for job ${jobId}`, error);
  }
}
