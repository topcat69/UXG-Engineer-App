import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { appBaseUrl } from "@/lib/app-url";
import { humanize } from "@/lib/format/text";
import { sendStandaloneEmail, type SendResult } from "./resend";
import { buildDamagedStockAlertEmail } from "./templates";

// See resend.ts's AnySupabaseClient comment — callers pass either the SSR
// server client or the service-role admin client.
type AnySupabaseClient = SupabaseClient<Database>;

const SKIPPED: SendResult = { status: "skipped", messageId: null };

/**
 * "Damaged Stock Alert" — fans out to every active superadmin/manager/
 * warehouse/finance user (decision 3 of the Damaged Equipment scope), same
 * one-way best-effort contract as sendAssetNeedsReviewEmail. Not job-scoped,
 * so it's a standalone send rather than threaded.
 */
export async function sendDamagedStockAlertEmail(
  supabase: AnySupabaseClient,
  damagedEquipmentId: string,
  to: string,
): Promise<SendResult> {
  const { data: item } = await supabase
    .from("damaged_equipment")
    .select("manufacturer, model, serial_number, damage_notes, next_step, site:sites(name, client:clients(name))")
    .eq("id", damagedEquipmentId)
    .single();
  if (!item) return SKIPPED;

  const itemLabel = ([item.manufacturer, item.model].filter(Boolean).join(" ") + (item.serial_number ? ` (${item.serial_number})` : "")).trim();

  const content = buildDamagedStockAlertEmail({
    itemLabel: itemLabel || "Untitled item",
    clientName: item.site?.client?.name ?? null,
    siteName: item.site?.name ?? null,
    damageNotes: item.damage_notes,
    nextStep: humanize(item.next_step),
    deepLink: `${appBaseUrl()}/office/damaged-equipment`,
  });
  return sendStandaloneEmail(to, content);
}
