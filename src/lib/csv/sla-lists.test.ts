import { describe, expect, it } from "vitest";
import { parseSlaListCsv } from "./sla-lists";

describe("parseSlaListCsv", () => {
  it("parses valid rows", () => {
    const csv = `name\nShark Beauty\nLive gaming`;
    const { rows, errors } = parseSlaListCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows).toEqual([{ name: "Shark Beauty" }, { name: "Live gaming" }]);
  });

  it("skips rows missing the required name column and reports why", () => {
    // A truly blank line is dropped by skipEmptyLines before it ever
    // reaches the row parser, so this uses a whitespace-only line — the
    // only way a single-column CSV can produce a "row with no name" at all.
    const csv = `name\n   \nWow`;
    const { rows, errors } = parseSlaListCsv(csv);
    expect(rows).toEqual([{ name: "Wow" }]);
    expect(errors.some((e) => e.includes("missing required"))).toBe(true);
  });

  it("is case-insensitive and trims header whitespace", () => {
    const csv = ` Name \nShark Beauty`;
    const { rows, errors } = parseSlaListCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows).toEqual([{ name: "Shark Beauty" }]);
  });

  it("returns no rows for an empty CSV", () => {
    const { rows } = parseSlaListCsv("name\n");
    expect(rows).toHaveLength(0);
  });
});
