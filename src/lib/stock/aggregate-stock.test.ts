import { describe, expect, it } from "vitest";
import { groupEarmarkedStock, groupShelfStock, type EarmarkedStockRow, type ShelfStockRow } from "./aggregate-stock";

describe("groupEarmarkedStock", () => {
  it("sums quantity per manufacturer/model/job-sheet combination", () => {
    const rows: EarmarkedStockRow[] = [
      {
        manufacturer: "Philips",
        model: "BDL4650D",
        jobSheetId: "js-1",
        jobSheetReference: "JS-001",
        jobSheetStatus: "configuring",
        jobNumber: "UXG-2026-0031",
        siteName: "Merrow Retail Park",
      },
      {
        manufacturer: "Philips",
        model: "BDL4650D",
        jobSheetId: "js-1",
        jobSheetReference: "JS-001",
        jobSheetStatus: "configuring",
        jobNumber: "UXG-2026-0031",
        siteName: "Merrow Retail Park",
      },
      {
        manufacturer: "Philips",
        model: "BDL4650D",
        jobSheetId: "js-2",
        jobSheetReference: "JS-002",
        jobSheetStatus: "ready",
        jobNumber: "UXG-2026-0045",
        siteName: "Oxford Street",
      },
    ];

    const groups = groupEarmarkedStock(rows);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ jobSheetReference: "JS-001", quantity: 2 });
    expect(groups[1]).toMatchObject({ jobSheetReference: "JS-002", quantity: 1 });
  });

  it("keeps the same manufacturer/model on different job sheets as separate groups", () => {
    const base = {
      manufacturer: "Samsung",
      model: "QM55R",
      jobSheetStatus: "assigned",
      jobNumber: null,
      siteName: null,
    };
    const rows: EarmarkedStockRow[] = [
      { ...base, jobSheetId: "a", jobSheetReference: "A" },
      { ...base, jobSheetId: "b", jobSheetReference: "B" },
    ];

    expect(groupEarmarkedStock(rows)).toHaveLength(2);
  });

  it("treats a null manufacturer/model as its own group rather than merging with everything", () => {
    const rows: EarmarkedStockRow[] = [
      {
        manufacturer: null,
        model: null,
        jobSheetId: "js-1",
        jobSheetReference: "JS-001",
        jobSheetStatus: "receiving",
        jobNumber: null,
        siteName: null,
      },
      {
        manufacturer: "LG",
        model: "43UH5N-H",
        jobSheetId: "js-1",
        jobSheetReference: "JS-001",
        jobSheetStatus: "receiving",
        jobNumber: null,
        siteName: null,
      },
    ];

    const groups = groupEarmarkedStock(rows);
    expect(groups).toHaveLength(2);
    expect(groups.some((g) => g.manufacturer === null && g.quantity === 1)).toBe(true);
  });

  it("returns an empty array for no rows", () => {
    expect(groupEarmarkedStock([])).toEqual([]);
  });
});

describe("groupShelfStock", () => {
  it("sums quantity per manufacturer/model", () => {
    const rows: ShelfStockRow[] = [
      { manufacturer: "Peerless-AV", model: "SF680" },
      { manufacturer: "Peerless-AV", model: "SF680" },
      { manufacturer: "BrightSign", model: "XD1035" },
    ];

    const groups = groupShelfStock(rows);

    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.model === "SF680")?.quantity).toBe(2);
    expect(groups.find((g) => g.model === "XD1035")?.quantity).toBe(1);
  });

  it("sorts alphabetically by manufacturer then model", () => {
    const rows: ShelfStockRow[] = [
      { manufacturer: "Samsung", model: "QM55R" },
      { manufacturer: "BrightSign", model: "XD1035" },
    ];

    const groups = groupShelfStock(rows);
    expect(groups.map((g) => g.manufacturer)).toEqual(["BrightSign", "Samsung"]);
  });
});
