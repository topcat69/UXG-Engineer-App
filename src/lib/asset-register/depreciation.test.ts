import { describe, expect, it } from "vitest";
import { computeStraightLineDepreciation } from "./depreciation";

describe("computeStraightLineDepreciation", () => {
  it("returns null when purchase date is missing", () => {
    expect(computeStraightLineDepreciation({ purchaseDate: null, purchaseCost: 1000, usefulLifeYears: 5, residualValue: 0 })).toBeNull();
  });

  it("returns null when purchase cost is missing", () => {
    expect(
      computeStraightLineDepreciation({ purchaseDate: "2020-01-01", purchaseCost: null, usefulLifeYears: 5, residualValue: 0 }),
    ).toBeNull();
  });

  it("returns null when useful life is missing or zero", () => {
    expect(
      computeStraightLineDepreciation({ purchaseDate: "2020-01-01", purchaseCost: 1000, usefulLifeYears: null, residualValue: 0 }),
    ).toBeNull();
    expect(
      computeStraightLineDepreciation({ purchaseDate: "2020-01-01", purchaseCost: 1000, usefulLifeYears: 0, residualValue: 0 }),
    ).toBeNull();
  });

  it("computes accumulated depreciation and book value partway through the useful life", () => {
    const asOf = new Date("2022-01-01"); // exactly 2 years after purchase
    const result = computeStraightLineDepreciation(
      { purchaseDate: "2020-01-01", purchaseCost: 10000, usefulLifeYears: 5, residualValue: 1000 },
      asOf,
    );
    expect(result).not.toBeNull();
    // Uses a 365.25-day year, so a real two-calendar-year span (which
    // includes a leap day) comes out a few hours over 2.0 exactly — these
    // check "close to the round number", not bit-for-bit equality.
    expect(result!.ageYears).toBeCloseTo(2, 1);
    expect(result!.annualDepreciation).toBeCloseTo(1800, 2); // (10000-1000)/5
    expect(Math.abs(result!.accumulatedDepreciation - 3600)).toBeLessThan(5); // ~1800 * 2
    expect(Math.abs(result!.bookValue - 6400)).toBeLessThan(5); // ~10000 - 3600
    expect(result!.isFullyDepreciated).toBe(false);
  });

  it("treats a missing residual value as zero", () => {
    const asOf = new Date("2021-01-01");
    const result = computeStraightLineDepreciation({ purchaseDate: "2020-01-01", purchaseCost: 5000, usefulLifeYears: 5, residualValue: null }, asOf);
    expect(result!.annualDepreciation).toBeCloseTo(1000, 2);
  });

  it("clamps book value to the residual value once past the useful life", () => {
    const asOf = new Date("2030-01-01"); // 10 years after a 5-year useful life
    const result = computeStraightLineDepreciation(
      { purchaseDate: "2020-01-01", purchaseCost: 10000, usefulLifeYears: 5, residualValue: 1000 },
      asOf,
    );
    expect(result!.bookValue).toBeCloseTo(1000, 1);
    expect(result!.isFullyDepreciated).toBe(true);
  });

  it("clamps age to zero for a future purchase date rather than going negative", () => {
    const asOf = new Date("2020-01-01");
    const result = computeStraightLineDepreciation(
      { purchaseDate: "2025-01-01", purchaseCost: 10000, usefulLifeYears: 5, residualValue: 0 },
      asOf,
    );
    expect(result!.ageYears).toBe(0);
    expect(result!.accumulatedDepreciation).toBe(0);
    expect(result!.bookValue).toBeCloseTo(10000, 1);
    expect(result!.isFullyDepreciated).toBe(false);
  });

  it("shows full book value with zero accumulated depreciation on the purchase date itself", () => {
    const asOf = new Date("2020-01-01");
    const result = computeStraightLineDepreciation(
      { purchaseDate: "2020-01-01", purchaseCost: 2000, usefulLifeYears: 4, residualValue: 0 },
      asOf,
    );
    expect(result!.ageYears).toBe(0);
    expect(result!.accumulatedDepreciation).toBe(0);
    expect(result!.bookValue).toBe(2000);
  });
});
