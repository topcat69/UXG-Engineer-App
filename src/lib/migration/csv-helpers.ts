import Papa from "papaparse";

/** Every AppSheet-export parser shares this shape: parsed rows plus a list of skipped-row reasons. */
export type ParseResult<T> = { rows: T[]; errors: string[] };

export function parseCsvRows(text: string): { data: Record<string, string>[]; errors: string[] } {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  return {
    data: parsed.data,
    errors: parsed.errors.map((e) => `Row ${(e.row ?? 0) + 2}: ${e.message}`),
  };
}

export function optionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function parseOptionalNumber(value: string | undefined, field: string, rowNumber: number, errors: string[]): number | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  if (Number.isNaN(n)) {
    errors.push(`Row ${rowNumber}: invalid ${field} "${trimmed}"`);
    return undefined;
  }
  return n;
}

export function parseOptionalBoolean(value: string | undefined): boolean | undefined {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed) return undefined;
  if (["true", "yes", "y", "1"].includes(trimmed)) return true;
  if (["false", "no", "n", "0"].includes(trimmed)) return false;
  return undefined;
}

/** AppSheet exports timestamps in various forms; only ISO-parseable values are accepted, everything else is a per-row error rather than silently importing an unusable date. */
export function parseOptionalTimestamp(value: string | undefined, field: string, rowNumber: number, errors: string[]): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) {
    errors.push(`Row ${rowNumber}: invalid ${field} "${trimmed}"`);
    return undefined;
  }
  return d.toISOString();
}

export function parseEnum<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  field: string,
  rowNumber: number,
  errors: string[],
): T | undefined {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed) return undefined;
  const match = allowed.find((a) => a.toLowerCase() === trimmed);
  if (!match) {
    errors.push(`Row ${rowNumber}: unrecognised ${field} "${trimmed}" (expected one of ${allowed.join(", ")})`);
    return undefined;
  }
  return match;
}

/** A case-insensitive natural-key -> id lookup, for resolving e.g. a "site name" CSV column to the site's UUID. */
export function buildLookup(entries: { key: string; id: string }[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const { key, id } of entries) map.set(key.trim().toLowerCase(), id);
  return map;
}

export function lookupId(map: Map<string, string>, key: string | undefined): string | undefined {
  if (!key) return undefined;
  return map.get(key.trim().toLowerCase());
}
