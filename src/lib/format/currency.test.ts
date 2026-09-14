import { describe, expect, it } from "vitest";
import { formatGbp } from "./currency";

describe("formatGbp", () => {
  it("formats a positive amount with thousands separators", () => {
    expect(formatGbp(1234.5)).toBe("£1,234.50");
  });

  it("formats zero", () => {
    expect(formatGbp(0)).toBe("£0.00");
  });

  it("formats a negative amount", () => {
    expect(formatGbp(-50)).toBe("-£50.00");
  });

  it("returns an em dash for null or undefined", () => {
    expect(formatGbp(null)).toBe("—");
    expect(formatGbp(undefined)).toBe("—");
  });
});
