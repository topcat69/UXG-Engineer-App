/**
 * UXG Brand Manual (2023) — Section 2, Brand Palette. Hex values copied
 * verbatim rather than approximated from the printed swatches. Split out
 * from brand.ts (which is `server-only` — it also does pdfkit drawing and
 * reads the logo file off disk) so this plain data, and anything pure built
 * on it, can be imported from a Vitest test without server-only's
 * bundler-only import guard throwing.
 */
export const BRAND = {
  charcoal: "#515559",
  paleGrey: "#E4E4E7",
  ledBlue: "#00D1DB",
  digitalPink: "#EA3865",
  retailOrange: "#F19215",
  hubBlue: "#333A80",
  white: "#FEFEFE",
} as const;
