import { describe, expect, it } from "vitest";
import { formatGpsTimestampOverlay } from "./overlay-text";

describe("formatGpsTimestampOverlay", () => {
  it("formats coordinates to 6 decimal places with the timestamp", () => {
    const text = formatGpsTimestampOverlay(51.5074, -0.1278, "2026-08-10T09:15:00.000Z");
    expect(text).toContain("51.507400, -0.127800");
    expect(text).toContain("UTC");
  });

  it("says 'No GPS data' rather than a bogus coordinate when GPS is missing", () => {
    const text = formatGpsTimestampOverlay(null, null, "2026-08-10T09:15:00.000Z");
    expect(text).toContain("No GPS data");
    expect(text).not.toContain("null");
  });

  it("still includes the timestamp when only GPS is missing", () => {
    const text = formatGpsTimestampOverlay(null, null, "2026-08-10T09:15:00.000Z");
    expect(text).toMatch(/\d{4}|Aug|10/);
  });
});
