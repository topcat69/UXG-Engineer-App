import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSecret } from "@/lib/webhooks/verify-secret";
import { selectLifecycleEligibleJobIds } from "@/lib/storage/media-lifecycle";

/**
 * Meant to be hit periodically by an external scheduler, same as the
 * day-before-reminders/weekly-summary cron routes — see their comments
 * for why this sandbox uses a plain authenticated route rather than a
 * self-triggering one.
 *
 * Deletes storage objects and their media_assets/signatures rows for jobs
 * that have sat in draft or cancelled status past the retention window —
 * see src/lib/storage/media-lifecycle.ts for why this is implemented in
 * application code rather than a bucket-level policy.
 */
export async function POST(request: Request) {
  if (!verifyWebhookSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: jobs } = await supabase.from("jobs").select("id, status, updated_at").in("status", ["draft", "cancelled"]);
  const eligibleJobIds = selectLifecycleEligibleJobIds(jobs ?? [], new Date().toISOString());

  let objectsDeleted = 0;
  let mediaAssetsDeleted = 0;
  let signaturesDeleted = 0;

  for (const jobId of eligibleJobIds) {
    const prefix = `jobs/${jobId}`;
    const { data: files } = await supabase.storage.from("media").list(prefix);
    if (files && files.length > 0) {
      const { data: removed } = await supabase.storage.from("media").remove(files.map((f) => `${prefix}/${f.name}`));
      objectsDeleted += removed?.length ?? 0;
    }

    const { data: deletedMedia } = await supabase.from("media_assets").delete().eq("job_id", jobId).select("id");
    mediaAssetsDeleted += deletedMedia?.length ?? 0;

    const { data: deletedSignatures } = await supabase.from("signatures").delete().eq("job_id", jobId).select("id");
    signaturesDeleted += deletedSignatures?.length ?? 0;
  }

  return NextResponse.json({
    jobsProcessed: eligibleJobIds.length,
    objectsDeleted,
    mediaAssetsDeleted,
    signaturesDeleted,
  });
}
