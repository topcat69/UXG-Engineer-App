// GBP only — no other currency appears anywhere in this app.
const GBP_FORMATTER = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

export function formatGbp(value: number | null | undefined): string {
  if (value == null) return "—";
  return GBP_FORMATTER.format(value);
}
