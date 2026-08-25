import "server-only";
import { appBaseUrl } from "@/lib/app-url";
import { computeMapWindow, TILE_SIZE } from "./tile-math";

export { TILE_SIZE };

const ZOOM = 15; // matches components/site-map.tsx's Leaflet zoom, for visual consistency with the job detail page's own map

async function fetchTile(x: number, y: number): Promise<Buffer | null> {
  try {
    const response = await fetch(`https://tile.openstreetmap.org/${ZOOM}/${x}/${y}.png`, {
      headers: { "User-Agent": `UXG-Engineer-Job-Scheduler/1.0 (${appBaseUrl()})` },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

export type SiteMapPlan = {
  windowWidthPx: number;
  windowLeftPx: number;
  windowTopPx: number;
  markerPx: { x: number; y: number };
  tiles: { x: number; y: number; bytes: Buffer }[];
};

/**
 * Fetches the OpenStreetMap tiles needed to render a small area map around
 * a site, at whatever raw pixel resolution matches the requested PDF box
 * size (see tile-math.ts's computeMapWindow for the geometry), plus the
 * site's exact pixel position within that window so the caller can draw a
 * marker at the right spot (see brand.ts's drawSiteMap).
 *
 * Returns null if ANY tile fails to fetch — a half-drawn map (some tiles
 * present, some blank) reads as broken in a way a map that's simply absent
 * doesn't, and per the Nominatim addenda in DECISIONS.md, this app doesn't
 * assume OpenStreetMap's infrastructure is reliably reachable from this
 * server on every request; the report needs to stay a complete, valid
 * document with or without this section.
 */
export async function buildSiteMapPlan(
  latitude: number,
  longitude: number,
  targetWidthPt: number,
  targetHeightPt: number,
): Promise<SiteMapPlan | null> {
  const window = computeMapWindow(latitude, longitude, targetWidthPt, targetHeightPt, ZOOM);

  const fetched = await Promise.all(window.tileCoords.map(({ x, y }) => fetchTile(x, y)));
  if (fetched.some((bytes) => bytes === null)) return null;

  return {
    windowWidthPx: window.windowWidthPx,
    windowLeftPx: window.windowLeftPx,
    windowTopPx: window.windowTopPx,
    markerPx: window.markerPx,
    tiles: window.tileCoords.map((coord, i) => ({ ...coord, bytes: fetched[i]! })),
  };
}
