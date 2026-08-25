import { centroidForRoutingKey } from "./eircode-routing-keys";

/**
 * Geocodes a postcode/Eircode — postcodes.io (UK, precise, no API key)
 * first, falling back to the static Eircode routing-key table for Ireland.
 * postcodes.io's dataset is UK-only: a real Irish site's Eircode always
 * misses on the first try (postcodes.io returns 404 for anything it
 * doesn't recognise, not a slow failure).
 *
 * Previously the Ireland fallback was a live call to Nominatim
 * (OpenStreetMap's free public geocoder). That went through three rounds
 * of fixes this session (no Irish coverage at all, then a wrong-country
 * mismatch from an under-specified query, then evidence it simply
 * isn't reliably reachable from this app's production server at all — see
 * DECISIONS.md) before being replaced outright with the static table:
 * postcodes.io covers the UK completely and the routing-key table covers
 * all 139 of Ireland's, which is this app's whole real-world scope, so
 * there's nothing left for a live third-party geocoder to add — only
 * a new way for the request to fail.
 */
export async function geocodePostcode(
  postcode: string,
): Promise<{ latitude: number; longitude: number } | null> {
  const trimmed = postcode.trim();
  if (!trimmed) return null;

  const uk = await geocodeViaPostcodesIo(trimmed);
  if (uk) return uk;

  return centroidForRoutingKey(trimmed);
}

async function geocodeViaPostcodesIo(postcode: string): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`);
    if (!response.ok) return null;
    const body = await response.json();
    if (body?.status !== 200 || typeof body?.result?.latitude !== "number" || typeof body?.result?.longitude !== "number") {
      return null;
    }
    return { latitude: body.result.latitude, longitude: body.result.longitude };
  } catch {
    return null;
  }
}
