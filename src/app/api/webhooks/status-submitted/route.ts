import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSubmittedEmail } from "@/lib/email/send-job-emails";
import { verifyWebhookSecret } from "@/lib/webhooks/verify-secret";

/**
 * Called by the status_events "submitted" trigger (pg_net, see
 * supabase/migrations/20260109000000_status_submitted_webhook.sql) rather
 * than any browser session — the field app writes status_events directly
 * via PostgREST, so this route is the only reliable place to notice a
 * submission and email the managers, regardless of whether it came from
 * the office UI or an offline sync. Authenticated by a shared secret
 * header, not Supabase auth, since Postgres has no user session to send.
 */
export async function POST(request: Request) {
  if (!verifyWebhookSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { job_id?: string };
  if (!body.job_id) return NextResponse.json({ error: "Missing job_id" }, { status: 400 });

  const supabase = createAdminClient();
  const { data: managers } = await supabase
    .from("users")
    .select("email, name")
    .in("role", ["superadmin", "manager"])
    .eq("active", true);

  // Fan out to every active manager/superadmin — there's no single
  // designated "the manager" for a job in this schema.
  await Promise.all(
    (managers ?? []).map((manager) => sendSubmittedEmail(supabase, body.job_id!, manager.email, manager.name)),
  );

  await bumpInstalledAssets(supabase, body.job_id);

  return NextResponse.json({ notified: managers?.length ?? 0 });
}

/**
 * Asset Register decision 10: install_date is set automatically the
 * moment the linked job is actually submitted, not typed in by a
 * manager — this is that moment. A job can have more than one linked
 * job sheet (e.g. a multi-visit install), so every asset register row
 * tied to any of them via stock_item_id gets bumped. install_date is
 * only set if still null (never overwritten on a later resubmit — e.g.
 * a revisit job), and status only moves spare -> in_use, never
 * overriding a status a manager has already set to faulty/in_repair/
 * retired.
 */
async function bumpInstalledAssets(supabase: ReturnType<typeof createAdminClient>, jobId: string): Promise<void> {
  const { data: jobSheets } = await supabase.from("job_sheets").select("id").eq("linked_job_id", jobId);
  const jobSheetIds = (jobSheets ?? []).map((s) => s.id);
  if (jobSheetIds.length === 0) return;

  const { data: stockItems } = await supabase.from("stock_items").select("id").in("job_sheet_id", jobSheetIds);
  const stockItemIds = (stockItems ?? []).map((s) => s.id);
  if (stockItemIds.length === 0) return;

  const { data: assets } = await supabase.from("asset_register").select("id, install_date, status").in("stock_item_id", stockItemIds);
  const today = new Date().toISOString().slice(0, 10);

  await Promise.all(
    (assets ?? []).map((asset) => {
      const update: { install_date?: string; status?: "in_use" } = {};
      if (!asset.install_date) update.install_date = today;
      if (asset.status === "spare") update.status = "in_use";
      if (Object.keys(update).length === 0) return Promise.resolve();
      return supabase.from("asset_register").update(update).eq("id", asset.id);
    }),
  );
}
