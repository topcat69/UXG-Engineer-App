import Papa from "papaparse";

export type ParsedSlaListRow = { name: string };

export type ParsedSlaListCsv = {
  rows: ParsedSlaListRow[];
  errors: string[];
};

/**
 * Pure CSV -> row parser for both client_sla_fixture_types and
 * client_sla_reasons — same one-column shape, so one parser covers both;
 * the caller attaches client_id (mirrors parseSitesCsv/parseClientsCsv,
 * which don't take a client/customer id from the file either). Required
 * column: `name`.
 */
export function parseSlaListCsv(text: string): ParsedSlaListCsv {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    // A file with only the required `name` column has no comma anywhere in
    // it, so Papa's delimiter auto-detection can't find one and reports an
    // "UndetectableDelimiter" parse error even though the single-column
    // parse itself is perfectly correct — pinning the delimiter (every
    // other CSV parser in this codebase gets multi-column real-world files
    // and never hits this) skips that guess entirely.
    delimiter: ",",
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const errors: string[] = parsed.errors.map((e) => `Row ${(e.row ?? 0) + 2}: ${e.message}`);
  const rows: ParsedSlaListRow[] = [];

  parsed.data.forEach((raw, index) => {
    const rowNumber = index + 2;
    const name = raw.name?.trim();
    if (!name) {
      errors.push(`Row ${rowNumber}: missing required "name" column`);
      return;
    }
    rows.push({ name });
  });

  return { rows, errors };
}
