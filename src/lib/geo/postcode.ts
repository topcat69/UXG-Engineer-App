import { appBaseUrl } from "@/lib/app-url";

export type GeocodeContext = { addressLine1?: string; town?: string };

/**
 * Geocodes a postcode/Eircode — postcodes.io first (fast, precise, no
 * API key), falling back to Nominatim when that fails. postcodes.io's
 * dataset is UK-only: a real Irish site's Eircode always misses on the
 * first try (postcodes.io returns 404 for anything it doesn't recognise,
 * not a slow failure), silently leaving the site with no coordinates —
 * which is what kept Irish jobs off the dashboard map entirely (see
 * DECISIONS.md) even though nothing else in this app assumes UK-only.
 * `context` (street/town) is passed through to the Nominatim fallback only
 * — a bare Eircode has no house-numbering meaning to Nominatim's free-text
 * search the way a UK postcode does, so an unadorned "T12 D291" query can
 * match on partial text alone rather than a real place (this produced a
 * Cork site plotted in Belfast — see DECISIONS.md); a proper street/town
 * string disambiguates it.
 * Used both server-side (office/clients/actions.ts, geocoding a site's
 * postcode on save) and client-side (media-capture.ts's GPS fallback),
 * so this can't assume a Node-only fetch.
 */
export async function geocodePostcode(
  postcode: string,
  context?: GeocodeContext,
): Promise<{ latitude: number; longitude: number } | null> {
  const trimmed = postcode.trim();
  if (!trimmed) return null;

  const uk = await geocodeViaPostcodesIo(trimmed);
  if (uk) return uk;

  return geocodeViaNominatim(trimmed, context);
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
 * (and anywhere else) rather than just the UK. Scoped to Ireland only
 * ("ie", not "gb,ie"): this fallback only ever runs after postcodes.io has
 * already failed to place the postcode in the UK, so by the time we're
 * here it's not a UK address — leaving "gb" in scope let a bare Eircode
 * match a Northern Ireland result (Nominatim files NI under "gb", not
 * "ie") purely on partial text, e.g. a Cork site landing in Belfast; see
 * DECISIONS.md. Building the query from the fuller street/town context
 * when available (rather than the postcode alone) further narrows the
 * match to a real place instead of a text coincidence. Its usage policy
 * (operations.osmfoundation.org/policies/nominatim) asks for a real
 * identifying User-Agent rather than a generic script default — set here
 * for the server-side call sites; a browser silently drops any
 * script-supplied User-Agent override and sends its own real one instead
 * (a forbidden header a page can't rewrite), which still identifies the
 * request as a genuine browser rather than a scraping bot, just not by
 * this app's name specifically.
 */
async function geocodeViaNominatim(
  postcode: string,
  context?: GeocodeContext,
): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const query = [context?.addressLine1, context?.town, postcode]
      .map((part) => part?.trim())
      .filter((part): part is string => Boolean(part))
      .join(", ");
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "ie");
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
