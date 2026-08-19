import { describe, expect, it } from "vitest";
import { nextJobNumber, parseMaxSequence } from "./job-number";

describe("nextJobNumber", () => {
  it("pads the sequence to 4 digits", () => {
    expect(nextJobNumber(0, 2026, 1)).toBe("UXG-2026-0001");
    expect(nextJobNumber(9, 2026, 1)).toBe("UXG-2026-0010");
  });

  it("offsets from the current max for batch generation", () => {
    expect(nextJobNumber(60, 2026, 1)).toBe("UXG-2026-0061");
    expect(nextJobNumber(60, 2026, 50)).toBe("UXG-2026-0110");
  });

  it("does not pad beyond 4 digits once the sequence grows past it", () => {
    expect(nextJobNumber(9999, 2026, 1)).toBe("UXG-2026-10000");
  });
});

describe("parseMaxSequence", () => {
  it("returns 0 for an empty list", () => {
    expect(parseMaxSequence([], 2026)).toBe(0);
  });

  it("finds the highest sequence number for the given year", () => {
    expect(parseMaxSequence(["UXG-2026-0001", "UXG-2026-0010", "UXG-2026-0003"], 2026)).toBe(10);
  });

  it("ignores job numbers from a different year", () => {
    expect(parseMaxSequence(["UXG-2025-9999", "UXG-2026-0002"], 2026)).toBe(2);
  });

  it("stays gap-safe after a deletion — the max reflects what's still in the table, not a count", () => {
    // e.g. UXG-2026-0002 was deleted; the highest surviving number is still 0003
    expect(parseMaxSequence(["UXG-2026-0001", "UXG-2026-0003"], 2026)).toBe(3);
  });

  it("ignores job numbers that don't parse as this scheme", () => {
    expect(parseMaxSequence(["UXG-2026-abc", "legacy-import-42"], 2026)).toBe(0);
  });
});
