import { describe, expect, it } from "vitest";
import { formatDurationBetween } from "./duration";

describe("formatDurationBetween", () => {
  it("formats hours and minutes together", () => {
    expect(formatDurationBetween("2026-08-24T09:00:00Z", "2026-08-24T10:23:00Z")).toBe("1h 23m");
  });

  it("omits minutes when the duration is a whole number of hours", () => {
    expect(formatDurationBetween("2026-08-24T09:00:00Z", "2026-08-24T11:00:00Z")).toBe("2h");
  });

  it("omits hours when the duration is under an hour", () => {
    expect(formatDurationBetween("2026-08-24T09:00:00Z", "2026-08-24T09:45:00Z")).toBe("45m");
  });

  it("rounds to the nearest minute", () => {
    expect(formatDurationBetween("2026-08-24T09:00:00Z", "2026-08-24T09:00:29Z")).toBe("0m");
    expect(formatDurationBetween("2026-08-24T09:00:00Z", "2026-08-24T09:00:31Z")).toBe("1m");
  });

  it("returns null when either timestamp is missing", () => {
    expect(formatDurationBetween(null, "2026-08-24T09:00:00Z")).toBeNull();
    expect(formatDurationBetween("2026-08-24T09:00:00Z", null)).toBeNull();
    expect(formatDurationBetween(undefined, undefined)).toBeNull();
  });

  it("returns null when the end is before the start, rather than a negative duration", () => {
    expect(formatDurationBetween("2026-08-24T10:00:00Z", "2026-08-24T09:00:00Z")).toBeNull();
  });
});
