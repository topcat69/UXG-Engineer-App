#!/usr/bin/env tsx
/**
 * One-off backfill for sites saved with no latitude/longitude before this
 * app knew how to geocode them (or from back when Ireland's fallback
 * geocoder — Nominatim, since removed — wasn't reliably reachable in
 * production; see DECISIONS.md). Re-saving each one by hand through
 * Clients → site → Edit → Save also re-geocodes it, but this does every
 * affected site in one pass rather than one at a time.
 *
 * Usage:
 *
 *   pnpm backfill:site-coordinates
 */
import { geocodePostcode } from "../src/lib/geo/postcode";
import { createScriptAdminClient } from "./lib/supabase-admin";

async function main() {
  const supabase = createScriptAdminClient();

  const { data: sites, error } = await supabase
    .from("sites")
    .select("id, name, postcode")
    .is("latitude", null)
    .is("longitude", null)
    .not("postcode", "is", null);
  if (error) {
    console.error("Failed to load sites:", error.message);
    process.exit(1);
  }

  const candidates = (sites ?? []).filter((s) => s.postcode?.trim());
  if (candidates.length === 0) {
    console.log("No sites with a postcode and no coordinates found — nothing to do.");
    return;
  }

  let updated = 0;
  const unresolved: string[] = [];

  for (const site of candidates) {
    const coords = await geocodePostcode(site.postcode!);
    if (!coords) {
      unresolved.push(`${site.name} (${site.postcode})`);
      continue;
    }
    const { error: updateError } = await supabase
      .from("sites")
      .update({ latitude: coords.latitude, longitude: coords.longitude })
      .eq("id", site.id);
    if (updateError) {
      unresolved.push(`${site.name} (${site.postcode}) — update failed: ${updateError.message}`);
      continue;
    }
    updated++;
  }

  console.log(`Backfilled coordinates for ${updated} of ${candidates.length} site(s).`);
  if (unresolved.length > 0) {
    console.log(`\n${unresolved.length} site(s) still without coordinates (postcode not recognised):`);
    for (const line of unresolved) console.log(`  ${line}`);
  }
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
