// Pure depreciation math over an already-fetched asset — no Supabase call
// here, so every number this report shows is independently testable
// without a database (same philosophy as lib/dashboard/metrics.ts).

export type DepreciableAsset = {
  purchaseDate: string | null;
  purchaseCost: number | null;
  usefulLifeYears: number | null;
  residualValue: number | null;
};

export type DepreciationResult = {
  ageYears: number;
  annualDepreciation: number;
  accumulatedDepreciation: number;
  bookValue: number;
  isFullyDepreciated: boolean;
};

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

/**
 * Straight-line depreciation only — the sole formula this report knows how
 * to calculate, regardless of what's typed into the free-text
 * depreciation_method field (there's no enum constraining it; it's a note,
 * not something this code branches on). Returns null when there isn't
 * enough data to say anything: no purchase date, no purchase cost, or a
 * useful life of zero or less would divide by zero.
 *
 * residualValue defaults to 0 when null. ageYears is clamped to
 * [0, usefulLifeYears] — a future purchase date (data entry slip) never
 * produces a negative age, and an asset well past its useful life just
 * shows as fully depreciated rather than a book value below its residual.
 */
export function computeStraightLineDepreciation(asset: DepreciableAsset, asOf: Date = new Date()): DepreciationResult | null {
  const { purchaseDate, purchaseCost, usefulLifeYears, residualValue } = asset;
  if (!purchaseDate || purchaseCost == null || !usefulLifeYears || usefulLifeYears <= 0) return null;

  const purchased = new Date(purchaseDate);
  if (Number.isNaN(purchased.getTime())) return null;

  const residual = residualValue ?? 0;
  const rawAgeYears = (asOf.getTime() - purchased.getTime()) / MS_PER_YEAR;
  const ageYears = Math.min(Math.max(rawAgeYears, 0), usefulLifeYears);

  const annualDepreciation = (purchaseCost - residual) / usefulLifeYears;
  const accumulatedDepreciation = annualDepreciation * ageYears;
  const bookValue = Math.max(purchaseCost - accumulatedDepreciation, residual);

  return {
    ageYears,
    annualDepreciation,
    accumulatedDepreciation,
    bookValue,
    isFullyDepreciated: rawAgeYears >= usefulLifeYears,
  };
}
