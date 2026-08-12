import "server-only";
import JSZip from "jszip";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { downloadBytes, generateCompletionReport } from "./completion-report";
import { extensionFor, sanitizeFilename } from "./archive-naming";

type AnySupabaseClient = SupabaseClient<Database>;

/**
 * Bundles what generateCompletionReport can only summarize or skip —
 * full-resolution photos, videos (pdfkit can't embed those at all, see the
 * comment in completion-report.ts), and signature images — into one zip
 * alongside a copy of the PDF itself, so a manager pulling a job's report
 * gets both the readable summary and the original evidence files in a
 * single download.
 */
export async function generateJobArchive(supabase: AnySupabaseClient, jobId: string): Promise<Buffer> {
  const [{ data: job }, { data: media }, { data: signatures }] = await Promise.all([
    supabase.from("jobs").select("job_number").eq("id", jobId).single(),
    supabase.from("media_assets").select("*").eq("job_id", jobId).order("slot"),
    supabase.from("signatures").select("*").eq("job_id", jobId),
  ]);
  if (!job) throw new Error(`Job ${jobId} not found`);

  const zip = new JSZip();

  const pdf = await generateCompletionReport(supabase, jobId);
  zip.file(`${sanitizeFilename(job.job_number)}-report.pdf`, pdf);

  const mediaFolder = zip.folder("media")!;
  for (const item of media ?? []) {
    const bytes = await downloadBytes(supabase, item.storage_path);
    if (!bytes) continue;
    mediaFolder.file(`${sanitizeFilename(item.slot)}.${extensionFor(item.mime, item.media_type)}`, bytes);
  }

  const signaturesFolder = zip.folder("signatures")!;
  for (const signature of signatures ?? []) {
    const bytes = await downloadBytes(supabase, signature.storage_path);
    if (!bytes) continue;
    signaturesFolder.file(`${sanitizeFilename(signature.signer_name)}-${sanitizeFilename(signature.signer_role)}.png`, bytes);
  }

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
