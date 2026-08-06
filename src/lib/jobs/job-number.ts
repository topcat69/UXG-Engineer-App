/**
 * Mirrors the AppSheet build's job-number scheme exactly (see the AppSheet
 * build guide, section 5): `UXG-{year}-{4-digit sequence}`. Not
 * concurrency-safe — two office users generating jobs in the same instant
 * could collide — which is an accepted tradeoff at this scale (same
 * caveat the AppSheet guide states), not an oversight.
 */
export function nextJobNumber(existingCount: number, year: number, offset: number): string {
  return `UXG-${year}-${String(existingCount + offset).padStart(4, "0")}`;
}
