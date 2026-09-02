import "server-only";

const ZOOM = 15; // matches components/site-map.tsx's Google Maps zoom, for visual consistency with the job detail page's own map
const MAX_STATIC_MAP_DIMENSION_PX = 640; // Google Static Maps API's per-side cap on the `size` param

export type SiteMapImage = { bytes: Buffer; widthPx: number; heightPx: number };

/**
 * Fetches a ready-made site location image from Google's Static Maps API —
 * center pin and all, drawn server-side via the `markers` param, so unlike
 * the old OpenStreetMap-tile version there's no tile stitching or manual
 * marker-drawing left for the caller to do (see brand.ts's drawSiteMap).
 *
 * Uses GOOGLE_MAPS_API_KEY, not the browser-facing
 * NEXT_PUBLIC_GOOGLE_MAPS_API_KEY — a key restricted by HTTP referrer (as
 * the dashboard map's key should be) won't work for this server-to-server
 * call, which sends no matching Referer header; this one should be
 * restricted by IP (to this app's server) instead, with the "Maps Static
 * API" enabled on the same Google Cloud project.
 *
 * Returns null if there's no key configured, or the request fails for any
 * reason — same best-effort contract this had for OpenStreetMap tiles: the
 * report stays a complete, valid document with or without this section
 * (see completion-report.ts's caller).
 */
export async function fetchSiteMapImage(
  latitude: number,
  longitude: number,
  targetWidthPt: number,
  targetHeightPt: number,
): Promise<SiteMapImage | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  const scaleDown = Math.min(1, MAX_STATIC_MAP_DIMENSION_PX / Math.max(targetWidthPt, targetHeightPt));
  const widthPx = Math.max(1, Math.round(targetWidthPt * scaleDown));
  const heightPx = Math.max(1, Math.round(targetHeightPt * scaleDown));

  const params = new URLSearchParams({
    center: `${latitude},${longitude}`,
    zoom: String(ZOOM),
    size: `${widthPx}x${heightPx}`,
    scale: "2", // retina-density bitmap within the same logical `size` box, for print sharpness
    markers: `color:0xE6007E|${latitude},${longitude}`, // BRAND.digitalPink
    key: apiKey,
  });

  try {
    const response = await fetch(`https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return null;
    return { bytes: Buffer.from(await response.arrayBuffer()), widthPx, heightPx };
  } catch {
    return null;
  }
}
