import { describe, expect, it } from "vitest";
import { addDays, isoDate, mondayOf } from "./week";

describe("mondayOf", () => {
  it("returns the same date when given a Monday", () => {
    // 2026-08-03 is a Monday.
    expect(isoDate(mondayOf(new Date("2026-08-03T15:00:00Z")))).toBe("2026-08-03");
  });

  it("rolls back to Monday from a mid-week date", () => {
    expect(isoDate(mondayOf(new Date("2026-08-06T00:00:00Z")))).toBe("2026-08-03");
  });

  it("rolls back to Monday from a Sunday", () => {
    expect(isoDate(mondayOf(new Date("2026-08-09T00:00:00Z")))).toBe("2026-08-03");
  });
});

describe("addDays / isoDate", () => {
  it("adds days across a month boundary", () => {
    expect(isoDate(addDays(new Date("2026-08-28T00:00:00Z"), 5))).toBe("2026-09-02");
  });
});
