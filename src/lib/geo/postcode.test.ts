import { afterEach, describe, expect, it, vi } from "vitest";
import { geocodePostcode } from "./postcode";

describe("geocodePostcode", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns coordinates for a successful UK lookup", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 200, result: { latitude: 53.2, longitude: -0.5 } }),
      }),
    );
    await expect(geocodePostcode("LN4 1DZ")).resolves.toEqual({ latitude: 53.2, longitude: -0.5 });
  });

  it("returns null on a network failure rather than throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    await expect(geocodePostcode("LN4 1DZ")).resolves.toBeNull();
  });

  it("returns null for an empty postcode without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(geocodePostcode("  ")).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to the Eircode routing-key table for a postcode postcodes.io has no UK-only coverage for", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    await expect(geocodePostcode("D02 AF30")).resolves.toEqual({ latitude: 53.338, longitude: -6.2591 });
  });

  it("prefers a real UK match over ever consulting the Eircode table", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 200, result: { latitude: 53.2, longitude: -0.5 } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await geocodePostcode("LN4 1DZ");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns null when postcodes.io fails and no Eircode routing key matches", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    await expect(geocodePostcode("NOT A POSTCODE")).resolves.toBeNull();
  });
});
