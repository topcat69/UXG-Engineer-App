import { describe, expect, it } from "vitest";
import { BRAND } from "./brand-colors";
import { severityAccent } from "./severity";

describe("severityAccent", () => {
  it("uses Digital Pink for critical/high severity", () => {
    expect(severityAccent("critical")).toBe(BRAND.digitalPink);
    expect(severityAccent("high")).toBe(BRAND.digitalPink);
  });

  it("uses Charcoal for medium/low severity", () => {
    expect(severityAccent("medium")).toBe(BRAND.charcoal);
    expect(severityAccent("low")).toBe(BRAND.charcoal);
  });
});
