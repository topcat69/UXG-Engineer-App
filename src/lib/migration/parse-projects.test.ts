import { describe, expect, it } from "vitest";
import { parseProjectsCsv } from "./parse-projects";

describe("parseProjectsCsv", () => {
  it("parses a valid row", () => {
    const csv = "name,client_name,start_date,end_date,status\nRollout 2026,Acme Retail,2026-01-01,,active";
    const { rows, errors } = parseProjectsCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { name: "Rollout 2026", client_name: "Acme Retail", start_date: "2026-01-01", end_date: undefined, status: "active" },
    ]);
  });

  it("rejects a row missing the required name column", () => {
    const csv = "name,client_name\n,Acme Retail";
    const { rows, errors } = parseProjectsCsv(csv);
    expect(rows).toEqual([]);
    expect(errors).toEqual(['Row 2: missing required "name" column']);
  });
});
