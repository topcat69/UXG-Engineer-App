import { describe, expect, it } from "vitest";
import { buildLookup } from "./csv-helpers";
import { parseAssetsCsv, resolveAssetRows } from "./parse-assets";

describe("parseAssetsCsv / resolveAssetRows", () => {
  it("resolves a known site name to its id", () => {
    const { rows } = parseAssetsCsv("site_name,serial,model\nMain Store,SN123,ModelX");
    const lookup = buildLookup([{ key: "Main Store", id: "site-1" }]);
    const { rows: resolved, errors } = resolveAssetRows(rows, lookup);
    expect(errors).toEqual([]);
    expect(resolved).toEqual([{ site_id: "site-1", serial: "SN123", model: "ModelX", asset_type: undefined, install_date: undefined, warranty_end: undefined }]);
  });

  it("allows a blank site_name (site_id is nullable)", () => {
    const { rows } = parseAssetsCsv("site_name,serial\n,SN999");
    const { rows: resolved, errors } = resolveAssetRows(rows, buildLookup([]));
    expect(errors).toEqual([]);
    expect(resolved[0].site_id).toBeUndefined();
  });

  it("errors on an unknown, non-blank site_name", () => {
    const { rows } = parseAssetsCsv("site_name,serial\nGhost Site,SN1");
    const { rows: resolved, errors } = resolveAssetRows(rows, buildLookup([]));
    expect(resolved).toEqual([]);
    expect(errors).toEqual(['Row 2: unknown site "Ghost Site"']);
  });
});
