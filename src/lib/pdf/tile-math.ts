export const TILE_SIZE = 256;

/** Web Mercator lon/lat -> fractional pixel position in the whole zoom level's pixel space (standard slippy-map tile math). */
export function lonLatToPixel(lon: number, lat: number, zoom: number): { px: number; py: number } {
  const latRad = (lat * Math.PI) / 180;
  const n = 2 ** zoom;
  const px = ((lon + 180) / 360) * n * TILE_SIZE;
  const py = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n * TILE_SIZE;
  return { px, py };
}

export type MapWindow = {
  windowWidthPx: number;
  windowHeightPx: number;
  windowLeftPx: number;
  windowTopPx: number;
  markerPx: { x: number; y: number };
  tileCoords: { x: number; y: number }[];
};

/**
 * Pure geometry for a small area map centred on a site: which OpenStreetMap
 * tiles cover the requested box, and where the site's own marker lands
 * within that window in pixels — everything site-map.ts's buildSiteMapPlan
 * needs to know before it fetches a single tile. Split out from the actual
 * fetch so this can be unit tested without a network call, same pattern as
 * every other pure-logic/server-only split in this codebase (sync-logic.ts
 * vs calendar.ts, templates.ts vs send-job-emails.ts, ...).
 */
export function computeMapWindow(
  latitude: number,
  longitude: number,
  targetWidthPt: number,
  targetHeightPt: number,
  zoom: number,
): MapWindow {
  const RESOLUTION = 1.5; // raw tile px per PDF point, for reasonable print sharpness without fetching excess tiles
  const windowWidthPx = Math.round(targetWidthPt * RESOLUTION);
  const windowHeightPx = Math.round(targetHeightPt * RESOLUTION);

  const { px: centerPx, py: centerPy } = lonLatToPixel(longitude, latitude, zoom);
  const windowLeftPx = centerPx - windowWidthPx / 2;
  const windowTopPx = centerPy - windowHeightPx / 2;

  const firstTileX = Math.floor(windowLeftPx / TILE_SIZE);
  const lastTileX = Math.floor((windowLeftPx + windowWidthPx) / TILE_SIZE);
  const firstTileY = Math.floor(windowTopPx / TILE_SIZE);
  const lastTileY = Math.floor((windowTopPx + windowHeightPx) / TILE_SIZE);

  const tileCoords: { x: number; y: number }[] = [];
  for (let ty = firstTileY; ty <= lastTileY; ty++) {
    for (let tx = firstTileX; tx <= lastTileX; tx++) {
      tileCoords.push({ x: tx, y: ty });
    }
  }

  return {
    windowWidthPx,
    windowHeightPx,
    windowLeftPx,
    windowTopPx,
    markerPx: { x: centerPx - windowLeftPx, y: centerPy - windowTopPx },
    tileCoords,
  };
}
