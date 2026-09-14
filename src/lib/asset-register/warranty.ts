// Pure warranty-window classification over an already-fetched asset — no
// Supabase call here, same philosophy as depreciation.ts and
// lib/dashboard/metrics.ts.

export type WarrantyStatus = "no_warranty" | "expired" | "expiring_soon" | "active";

/**
 * "Expiring soon" defaults to 90 days out — enough lead time to renew or
 * budget for a replacement before cover actually lapses. An asset with no
 * warranty_end on file (or one that fails to parse) is "no_warranty", not
 * "expired" — those are different problems: one never had cover recorded,
 * the other's cover has actually run out.
 */
export function classifyWarrantyStatus(warrantyEnd: string | null, asOf: Date = new Date(), expiringSoonDays = 90): WarrantyStatus {
  if (!warrantyEnd) return "no_warranty";
  const end = new Date(warrantyEnd);
  if (Number.isNaN(end.getTime())) return "no_warranty";

  const daysRemaining = (end.getTime() - asOf.getTime()) / (1000 * 60 * 60 * 24);
  if (daysRemaining < 0) return "expired";
  if (daysRemaining <= expiringSoonDays) return "expiring_soon";
  return "active";
}
