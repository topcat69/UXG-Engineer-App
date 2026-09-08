/**
 * Turns a stored enum-ish value ("in_progress", "pass", "na", "manager")
 * into a display label ("In Progress", "Pass", "N/A", "Manager"). For
 * generic snake_case/lowercase status/severity/role/pass-fail values only —
 * never apply this to free text, names, or values that already carry
 * their own deliberate casing (e.g. the Select option lists in
 * install-form.ts/job-form.ts, which are authored in sentence case on
 * purpose).
 */
export function humanize(value: string): string {
  if (value.toLowerCase() === "na") return "N/A";
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Converts free text to Title Case regardless of its starting casing —
 * "ABERDEEN" and "aberdeen" both become "Aberdeen". Used to normalize
 * site name/address data, which often arrives ALL CAPS from a CSV export
 * or manual entry (see sites.ts's createSite/updateSite and
 * csv/sites.ts's parseSitesCsv). Capitalizes after any word boundary
 * (space, hyphen, apostrophe), same class of algorithm as Postgres's
 * initcap() — which the one-off cleanup migration for existing sites
 * uses, so old and new data end up formatted the same way. It doesn't
 * know about acronyms or genuinely-intentional casing ("O'Brien" comes
 * out right, "McDonald's" doesn't — an inherent limitation of this kind
 * of algorithm, not something worth special-casing for).
 */
export function titleCase(value: string): string {
  return value.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
