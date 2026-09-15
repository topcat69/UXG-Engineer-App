import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSecret } from "@/lib/webhooks/verify-secret";
import { customerJobsRootFolderId } from "@/lib/google/drive-folders";
import { syncMediaAssetToDrive, syncSignatureToDrive, syncJobDocumentToDrive, type JobDocumentKind } from "@/lib/google/drive-media-sync";

/**
 * Meant to be hit periodically by an external scheduler, same shape as
 * media-lifecycle/day-before-reminders/weekly-summary — see their
 * comments for why this sandbox uses a plain authenticated route rather
 * than a self-triggering one.
 *
 * Picks up whatever hasn't been mirrored to Drive yet — field
 * photos/videos, signatures, and the four office-prepared job_details
 * documents — and uploads it into the job's Drive folder (created here if
 * it doesn't exist yet). This is the retry mechanism Phase 3 needs: media
 * lands in Storage straight from the browser (drainMediaQueue runs
 * client-side, so there's no server request to hook a sync into — see
 * this migration's own comment), and whatever fails or is skipped this
 * run — Drive unreachable, a transient error — is still unmirrored next
 * run, with no separate backoff bookkeeping needed.
 *
 * Bounded to BATCH_SIZE per kind per run rather than draining everything
 * in one request, so a large backlog (e.g. Drive newly configured against
 * months of existing jobs) spreads across multiple runs instead of one
 * long-running request racing the platform's request timeout.
 */
const BATCH_SIZE = 50;
const JOB_DOCUMENT_KINDS: JobDocumentKind[] = ["rams", "site_plan", "design_pack", "parking_permit"];

export async function POST(request: Request) {
  if (!verifyWebhookSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!customerJobsRootFolderId()) {
    return NextResponse.json({ skipped: "Drive folder sync isn't configured" });
  }

  const supabase = createAdminClient();

  const { data: mediaAssets } = await supabase
    .from("media_assets")
    .select("id")
    .is("drive_file_id", null)
    .not("job_id", "is", null)
    .limit(BATCH_SIZE);
  for (const asset of mediaAssets ?? []) {
    await syncMediaAssetToDrive(supabase, asset.id);
  }

  const { data: signatures } = await supabase
    .from("signatures")
    .select("id")
    .is("drive_file_id", null)
    .not("job_id", "is", null)
    .limit(BATCH_SIZE);
  for (const signature of signatures ?? []) {
    await syncSignatureToDrive(supabase, signature.id);
  }

  // Flat, un-nested .or() (no and() grouping) — see DECISIONS.md's note on
  // why this codebase prefers plain filters over nested PostgREST filter
  // strings. Rows already fully mirrored still match here (this only
  // checks that *some* document exists, not which ones remain unsynced);
  // syncJobDocumentToDrive's own per-kind drive_file_id check is what
  // actually skips already-mirrored documents, cheaply.
  const { data: jobDetails } = await supabase
    .from("job_details")
    .select("job_id")
    .not("job_id", "is", null)
    .or("rams_storage_path.not.is.null,site_plan_storage_path.not.is.null,design_pack_storage_path.not.is.null,parking_permit_storage_path.not.is.null")
    .limit(BATCH_SIZE);
  for (const details of jobDetails ?? []) {
    if (!details.job_id) continue;
    for (const kind of JOB_DOCUMENT_KINDS) {
      await syncJobDocumentToDrive(supabase, details.job_id, kind);
    }
  }

  return NextResponse.json({
    mediaAssetsProcessed: mediaAssets?.length ?? 0,
    signaturesProcessed: signatures?.length ?? 0,
    jobsWithDocumentsProcessed: jobDetails?.length ?? 0,
  });
}
