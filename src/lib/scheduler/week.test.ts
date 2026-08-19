import { describe, expect, it } from "vitest";
import { addDays, formatTimeRange, isoDate, mondayOf } from "./week";

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

// Formats in the local timezone (matches the rest of the app's date
// display, e.g. the office job page's toLocaleString calls) — these
// assertions assume a UTC test environment, same as this sandbox and CI.
describe("formatTimeRange", () => {
  it("formats a start/end pair as HH:MM – HH:MM", () => {
    expect(formatTimeRange("2026-08-19T14:00:00Z", "2026-08-19T16:00:00Z")).toBe("14:00 – 16:00");
  });

  it("falls back to a single time when there's no end", () => {
    expect(formatTimeRange("2026-08-19T14:00:00Z", null)).toBe("14:00");
  });
});
