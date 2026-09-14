import { describe, expect, it } from "vitest";
import { buildCategoryLookup, buildSiteLookup, parseAssetRegisterCsv, resolveAssetRegisterRows } from "./asset-register";

describe("parseAssetRegisterCsv", () => {
  it("parses a full row, defaulting status to spare", () => {
    const csv = `category,manufacturer,model,serial_number,site,purchase_date,purchase_cost,useful_life_years,warranty_end,status
Displays,Samsung,QM75,SN-1,Head Office,2024-01-15,1234.56,5,2026-01-15,in_use`;
    const { rows, errors } = parseAssetRegisterCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      expect.objectContaining({
        categoryName: "Displays",
        manufacturer: "Samsung",
        model: "QM75",
        serialNumber: "SN-1",
        siteName: "Head Office",
        purchaseDate: "2024-01-15",
        purchaseCost: 1234.56,
        usefulLifeYears: 5,
        warrantyEnd: "2026-01-15",
        status: "in_use",
      }),
    ]);
  });

  it("defaults status to spare and allows a blank site", () => {
    const { rows, errors } = parseAssetRegisterCsv("manufacturer,model\nSamsung,QM75");
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ status: "spare", siteName: undefined });
  });

  it("errors when site is missing and status isn't spare", () => {
    const { rows, errors } = parseAssetRegisterCsv("manufacturer,status\nSamsung,in_use");
    expect(rows).toHaveLength(0);
    expect(errors).toEqual(["Row 2: site is required unless status is spare"]);
  });

  it("errors on an unrecognised status but keeps the row, defaulted to spare", () => {
    const { rows, errors } = parseAssetRegisterCsv("manufacturer,status\nSamsung,broken");
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("spare");
    expect(errors.some((e) => e.includes('unrecognised status "broken"'))).toBe(true);
  });

  it("accepts a status with spaces instead of an underscore", () => {
    const { rows, errors } = parseAssetRegisterCsv("manufacturer,site,status\nSamsung,HQ,in repair");
    expect(errors).toEqual([]);
    expect(rows[0].status).toBe("in_repair");
  });

  it("reports invalid numeric/date fields but keeps the row", () => {
    const csv = "manufacturer,purchase_cost,useful_life_years,purchase_date\nSamsung,not-a-number,x,also-not-a-date";
    const { rows, errors } = parseAssetRegisterCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].purchaseCost).toBeUndefined();
    expect(rows[0].usefulLifeYears).toBeUndefined();
    expect(rows[0].purchaseDate).toBeUndefined();
    expect(errors.some((e) => e.includes('invalid purchase_cost "not-a-number"'))).toBe(true);
    expect(errors.some((e) => e.includes('invalid useful_life_years "x"'))).toBe(true);
    expect(errors.some((e) => e.includes('invalid purchase_date "also-not-a-date"'))).toBe(true);
  });
});

describe("resolveAssetRegisterRows", () => {
  it("resolves category and a uniquely-named site", () => {
    const { rows } = parseAssetRegisterCsv("category,site\nDisplays,Head Office");
    const categoryLookup = buildCategoryLookup([{ id: "cat-1", name: "Displays" }]);
    const siteLookup = buildSiteLookup([{ id: "site-1", name: "Head Office", clientName: "Acme" }]);
    const { rows: resolved, errors } = resolveAssetRegisterRows(rows, categoryLookup, siteLookup);
    expect(errors).toEqual([]);
    expect(resolved).toEqual([
      expect.objectContaining({ category_id: "cat-1", site_id: "site-1", source: "import", needs_review: false }),
    ]);
  });

  it("allows a blank category and site (status spare)", () => {
    const { rows } = parseAssetRegisterCsv("manufacturer\nSamsung");
    const { rows: resolved, errors } = resolveAssetRegisterRows(rows, buildCategoryLookup([]), buildSiteLookup([]));
    expect(errors).toEqual([]);
    expect(resolved[0].category_id).toBeUndefined();
    expect(resolved[0].site_id).toBeUndefined();
  });

  it("errors on an unknown category", () => {
    const { rows } = parseAssetRegisterCsv("category\nGhost Category");
    const { rows: resolved, errors } = resolveAssetRegisterRows(rows, buildCategoryLookup([]), buildSiteLookup([]));
    expect(resolved).toEqual([]);
    expect(errors).toEqual(['Row 2: unknown category "Ghost Category"']);
  });

  it("errors on an unknown site", () => {
    const { rows } = parseAssetRegisterCsv("site\nGhost Site");
    const { rows: resolved, errors } = resolveAssetRegisterRows(rows, buildCategoryLookup([]), buildSiteLookup([]));
    expect(resolved).toEqual([]);
    expect(errors).toEqual(['Row 2: unknown site "Ghost Site"']);
  });

  it("disambiguates a site name shared by two clients using the client column", () => {
    const { rows } = parseAssetRegisterCsv("site,client\nHead Office,Beta Corp");
    const siteLookup = buildSiteLookup([
      { id: "site-acme", name: "Head Office", clientName: "Acme" },
      { id: "site-beta", name: "Head Office", clientName: "Beta Corp" },
    ]);
    const { rows: resolved, errors } = resolveAssetRegisterRows(rows, buildCategoryLookup([]), siteLookup);
    expect(errors).toEqual([]);
    expect(resolved[0].site_id).toBe("site-beta");
  });

  it("errors on an ambiguous site name with no client column", () => {
    const { rows } = parseAssetRegisterCsv("site\nHead Office");
    const siteLookup = buildSiteLookup([
      { id: "site-acme", name: "Head Office", clientName: "Acme" },
      { id: "site-beta", name: "Head Office", clientName: "Beta Corp" },
    ]);
    const { rows: resolved, errors } = resolveAssetRegisterRows(rows, buildCategoryLookup([]), siteLookup);
    expect(resolved).toEqual([]);
    expect(errors).toEqual(['Row 2: "Head Office" matches more than one site — add a "client" column to say which one']);
  });

  it("errors when the client column doesn't match any candidate for that site name", () => {
    const { rows } = parseAssetRegisterCsv("site,client\nHead Office,Ghost Client");
    const siteLookup = buildSiteLookup([
      { id: "site-acme", name: "Head Office", clientName: "Acme" },
      { id: "site-beta", name: "Head Office", clientName: "Beta Corp" },
    ]);
    const { rows: resolved, errors } = resolveAssetRegisterRows(rows, buildCategoryLookup([]), siteLookup);
    expect(resolved).toEqual([]);
    expect(errors).toEqual(['Row 2: no site named "Head Office" for client "Ghost Client"']);
  });
});
