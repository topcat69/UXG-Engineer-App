import { afterEach, describe, expect, it, vi } from "vitest";
import { geocodePostcode } from "./postcode";

describe("geocodePostcode", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns coordinates for a successful lookup", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 200, result: { latitude: 53.2, longitude: -0.5 } }),
      }),
    );
    await expect(geocodePostcode("LN4 1DZ")).resolves.toEqual({ latitude: 53.2, longitude: -0.5 });
  });

  it("returns null for an unknown postcode", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    await expect(geocodePostcode("NOT A POSTCODE")).resolves.toBeNull();
  });

  it("returns null on a network failure rather than throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );
    await expect(geocodePostcode("LN4 1DZ")).resolves.toBeNull();
  });

  it("returns null for an empty postcode without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(geocodePostcode("  ")).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never calls Nominatim once postcodes.io already succeeded", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 200, result: { latitude: 53.2, longitude: -0.5 } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await geocodePostcode("LN4 1DZ");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to Nominatim for an Eircode postcodes.io has no UK-only coverage for", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false }) // postcodes.io: not found
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ lat: "53.3498", lon: "-6.2603" }],
      });
    vi.stubGlobal("fetch", fetchMock);
    await expect(geocodePostcode("D02 AF30")).resolves.toEqual({ latitude: 53.3498, longitude: -6.2603 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const nominatimUrl = fetchMock.mock.calls[1][0] as URL;
    expect(nominatimUrl.toString()).toContain("nominatim.openstreetmap.org");
    expect(nominatimUrl.searchParams.get("q")).toBe("D02 AF30");
  });

  it("scopes the Nominatim fallback to Ireland only, not GB — a bare Eircode must never match a Northern Ireland result", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ lat: "53.3498", lon: "-6.2603" }] });
    vi.stubGlobal("fetch", fetchMock);
    await geocodePostcode("D02 AF30");
    const nominatimUrl = fetchMock.mock.calls[1][0] as URL;
    expect(nominatimUrl.searchParams.get("countrycodes")).toBe("ie");
  });

  it("builds the Nominatim query from street/town context plus the postcode, when given", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ lat: "51.9", lon: "-8.47" }] });
    vi.stubGlobal("fetch", fetchMock);
    await geocodePostcode("T12 D291", { addressLine1: "Unit 8, Mahon Retail Park", town: "Cork" });
    const nominatimUrl = fetchMock.mock.calls[1][0] as URL;
    expect(nominatimUrl.searchParams.get("q")).toBe("Unit 8, Mahon Retail Park, Cork, T12 D291");
  });

  it("returns null when both postcodes.io and Nominatim have nothing", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", fetchMock);
    await expect(geocodePostcode("NOT A POSTCODE")).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns null when Nominatim's result array is empty", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);
    await expect(geocodePostcode("D02 AF30")).resolves.toBeNull();
  });
});
