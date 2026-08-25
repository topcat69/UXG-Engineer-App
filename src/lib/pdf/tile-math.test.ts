import { describe, expect, it } from "vitest";
import { computeMapWindow, lonLatToPixel, TILE_SIZE } from "./tile-math";

describe("lonLatToPixel", () => {
  it("places (0, 0) at the exact centre of the whole-world tile at zoom 0", () => {
    expect(lonLatToPixel(0, 0, 0)).toEqual({ px: 128, py: 128 });
  });

  it("moves further right/down as longitude/latitude increase toward the map's edges", () => {
    const center = lonLatToPixel(0, 0, 10);
    const east = lonLatToPixel(10, 0, 10);
    const south = lonLatToPixel(0, -10, 10);
    expect(east.px).toBeGreaterThan(center.px);
    expect(south.py).toBeGreaterThan(center.py);
  });
});

describe("computeMapWindow", () => {
  // Halfords — Liffey Valley, from the field-app bug report this exists to fix.
  const DUBLIN_22 = { lat: 53.3225, lon: -6.3939 };

  it("always places the marker at the exact centre of the window, regardless of location", () => {
    const window = computeMapWindow(DUBLIN_22.lat, DUBLIN_22.lon, 512, 200, 15);
    expect(window.markerPx).toEqual({ x: window.windowWidthPx / 2, y: window.windowHeightPx / 2 });
  });

  it("scales the window to the requested PDF box size", () => {
    const window = computeMapWindow(DUBLIN_22.lat, DUBLIN_22.lon, 400, 100, 15);
    expect(window.windowWidthPx).toBe(600); // 400 * 1.5
    expect(window.windowHeightPx).toBe(150); // 100 * 1.5
  });

  it("covers the whole window with a small, bounded, gap-free set of tile coordinates", () => {
    const window = computeMapWindow(DUBLIN_22.lat, DUBLIN_22.lon, 512, 200, 15);
    expect(window.tileCoords.length).toBeGreaterThan(0);
    expect(window.tileCoords.length).toBeLessThan(20);

    const xs = window.tileCoords.map((t) => t.x);
    const ys = window.tileCoords.map((t) => t.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    // Every tile in the min..max rectangle is present — no holes in the grid.
    expect(window.tileCoords.length).toBe((maxX - minX + 1) * (maxY - minY + 1));

    // The tile grid's pixel extent must fully contain the requested window.
    expect(minX * TILE_SIZE).toBeLessThanOrEqual(window.windowLeftPx);
    expect((maxX + 1) * TILE_SIZE).toBeGreaterThanOrEqual(window.windowLeftPx + window.windowWidthPx);
    expect(minY * TILE_SIZE).toBeLessThanOrEqual(window.windowTopPx);
    expect((maxY + 1) * TILE_SIZE).toBeGreaterThanOrEqual(window.windowTopPx + window.windowHeightPx);
  });
});
