import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { appBaseUrl } from "@/lib/app-url";
import { sendStandaloneEmail, type SendResult } from "./resend";
import { buildAssetNeedsReviewEmail } from "./templates";

// See resend.ts's AnySupabaseClient comment — callers pass either the SSR
// server client or the service-role admin client.
type AnySupabaseClient = SupabaseClient<Database>;

const SKIPPED: SendResult = { status: "skipped", messageId: null };

/**
 * "New asset needs review" (decision 9 of the Asset Register scope) —
 * fans out to every active superadmin/manager, same audience and same
 * one-way best-effort contract as the existing "job submitted" email
 * (see api/webhooks/status-submitted). Not job-scoped, so it's a
 * standalone send rather than threaded.
 */
export async function sendAssetNeedsReviewEmail(
  supabase: AnySupabaseClient,
  assetRegisterId: string,
  to: string,
): Promise<SendResult> {
  const { data: asset } = await supabase
    .from("asset_register")
    .select("manufacturer, model, serial_number, site:sites(name)")
    .eq("id", assetRegisterId)
    .single();
  if (!asset) return SKIPPED;

  const assetLabel = [asset.manufacturer, asset.model].filter(Boolean).join(" ") + (asset.serial_number ? ` (${asset.serial_number})` : "");

  const content = buildAssetNeedsReviewEmail({
    assetLabel: assetLabel.trim() || "Untitled asset",
    siteName: asset.site?.name ?? null,
    deepLink: `${appBaseUrl()}/office/asset-register`,
  });
  return sendStandaloneEmail(to, content);
}
