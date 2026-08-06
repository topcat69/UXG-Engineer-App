import { describe, expect, it } from "vitest";
import { nextJobNumber } from "./job-number";

describe("nextJobNumber", () => {
  it("pads the sequence to 4 digits", () => {
    expect(nextJobNumber(0, 2026, 1)).toBe("UXG-2026-0001");
    expect(nextJobNumber(9, 2026, 1)).toBe("UXG-2026-0010");
  });

  it("offsets from the existing count for batch generation", () => {
    expect(nextJobNumber(60, 2026, 1)).toBe("UXG-2026-0061");
    expect(nextJobNumber(60, 2026, 50)).toBe("UXG-2026-0110");
  });

  it("does not pad beyond 4 digits once the count grows past it", () => {
    expect(nextJobNumber(9999, 2026, 1)).toBe("UXG-2026-10000");
  });
});
