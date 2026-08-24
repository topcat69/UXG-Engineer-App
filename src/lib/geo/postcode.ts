import { appBaseUrl } from "@/lib/app-url";

/**
 * Geocodes a postcode/Eircode — postcodes.io first (fast, precise, no
 * API key), falling back to Nominatim when that fails. postcodes.io's
 * dataset is UK-only: a real Irish site's Eircode always misses on the
 * first try (postcodes.io returns 404 for anything it doesn't recognise,
 * not a slow failure), silently leaving the site with no coordinates —
 * which is what kept Irish jobs off the dashboard map entirely (see
 * DECISIONS.md) even though nothing else in this app assumes UK-only.
 * Used both server-side (office/clients/actions.ts, geocoding a site's
 * postcode on save) and client-side (media-capture.ts's GPS fallback),
 * so this can't assume a Node-only fetch.
 */
export async function geocodePostcode(postcode: string): Promise<{ latitude: number; longitude: number } | null> {
  const trimmed = postcode.trim();
  if (!trimmed) return null;

  const uk = await geocodeViaPostcodesIo(trimmed);
  if (uk) return uk;

  return geocodeViaNominatim(trimmed);
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

/**
 * Nominatim (OpenStreetMap) — free, no API key, actually covers Ireland
 * (and anywhere else) rather than just the UK. Scoped to gb/ie since
 * that's where this app's sites actually are, so a postcode-shaped typo
 * doesn't silently resolve to some unrelated country. Its usage policy
 * (operations.osmfoundation.org/policies/nominatim) asks for a real
 * identifying User-Agent rather than a generic script default — set here
 * for the server-side call sites; a browser silently drops any
 * script-supplied User-Agent override and sends its own real one instead
 * (a forbidden header a page can't rewrite), which still identifies the
 * request as a genuine browser rather than a scraping bot, just not by
 * this app's name specifically.
 */
async function geocodeViaNominatim(postcode: string): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", postcode);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "gb,ie");
    const response = await fetch(url, {
      headers: { "User-Agent": `UXG-Engineer-Job-Scheduler/1.0 (${appBaseUrl()})` },
    });
    if (!response.ok) return null;
    const body = await response.json();
    const first = Array.isArray(body) ? body[0] : null;
    const latitude = first ? Number.parseFloat(first.lat) : NaN;
    const longitude = first ? Number.parseFloat(first.lon) : NaN;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude, longitude };
  } catch {
    return null;
  }
}
