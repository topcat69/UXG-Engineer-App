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
