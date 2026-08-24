import { BRAND } from "./brand-colors";

/** Blocking issues get UXG Digital Pink (the brand's own alert-adjacent colour); everything else gets Charcoal — no separate "warning" colour invented outside the palette. Pure, unlike the rest of brand.ts, so it's unit tested directly rather than only through a generated PDF. */
export function severityAccent(severity: string): string {
  return severity === "critical" || severity === "high" ? BRAND.digitalPink : BRAND.charcoal;
}
