import { describe, expect, it } from "vitest";
import { classifyWarrantyStatus } from "./warranty";

describe("classifyWarrantyStatus", () => {
  it("returns no_warranty when warranty_end is null", () => {
    expect(classifyWarrantyStatus(null)).toBe("no_warranty");
  });

  it("returns no_warranty for an unparseable date", () => {
    expect(classifyWarrantyStatus("not-a-date")).toBe("no_warranty");
  });

  it("returns expired for a date in the past", () => {
    const asOf = new Date("2026-01-01");
    expect(classifyWarrantyStatus("2025-01-01", asOf)).toBe("expired");
  });

  it("returns expiring_soon within the default 90-day window", () => {
    const asOf = new Date("2026-01-01");
    expect(classifyWarrantyStatus("2026-02-01", asOf)).toBe("expiring_soon"); // 31 days out
  });

  it("returns active beyond the default 90-day window", () => {
    const asOf = new Date("2026-01-01");
    expect(classifyWarrantyStatus("2027-01-01", asOf)).toBe("active"); // 365 days out
  });

  it("respects a custom expiringSoonDays window", () => {
    const asOf = new Date("2026-01-01");
    // 60 days out: expiring_soon under the default 90-day window, active under a tighter 30-day window.
    expect(classifyWarrantyStatus("2026-03-02", asOf, 90)).toBe("expiring_soon");
    expect(classifyWarrantyStatus("2026-03-02", asOf, 30)).toBe("active");
  });

  it("treats the expiry date itself as expiring_soon, not expired", () => {
    const asOf = new Date("2026-01-01T00:00:00Z");
    expect(classifyWarrantyStatus("2026-01-01T00:00:00Z", asOf)).toBe("expiring_soon");
  });
});
