import { describe, expect, it } from "vitest";
import { distanceMeters } from "./distance";

describe("distanceMeters", () => {
  it("returns 0 for the same point", () => {
    expect(distanceMeters(51.5, -0.1, 51.5, -0.1)).toBe(0);
  });

  it("matches a known reference distance (~1.05km, central London)", () => {
    // Trafalgar Square to Tower Bridge, roughly.
    const d = distanceMeters(51.5080, -0.1281, 51.5055, -0.0754);
    expect(d).toBeGreaterThan(3600);
    expect(d).toBeLessThan(3900);
  });

  it("is symmetric", () => {
    const a = distanceMeters(51.5, -0.1, 51.51, -0.11);
    const b = distanceMeters(51.51, -0.11, 51.5, -0.1);
    expect(a).toBeCloseTo(b, 6);
  });

  it("scales roughly linearly for small offsets (~111m per 0.001 degree latitude)", () => {
    const d = distanceMeters(51.5, -0.1, 51.501, -0.1);
    expect(d).toBeGreaterThan(105);
    expect(d).toBeLessThan(115);
  });
});
