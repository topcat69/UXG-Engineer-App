import Papa from "papaparse";
import type { Database } from "@/lib/supabase/database.types";

export type ClientInsert = Database["public"]["Tables"]["clients"]["Insert"];

export type ParsedClientsCsv = {
  rows: ClientInsert[];
  errors: string[];
};

/**
 * Pure CSV -> row parser, mirroring parseSitesCsv (lib/csv/sites.ts).
 * Required column: `name`. Everything else is optional and passed through.
 */
export function parseClientsCsv(text: string): ParsedClientsCsv {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const errors: string[] = parsed.errors.map((e) => `Row ${(e.row ?? 0) + 2}: ${e.message}`);
  const rows: ClientInsert[] = [];

  parsed.data.forEach((raw, index) => {
    const rowNumber = index + 2;
    const name = raw.name?.trim();
    if (!name) {
      errors.push(`Row ${rowNumber}: missing required "name" column`);
      return;
    }

    rows.push({
      name,
      contact_name: raw.contact_name?.trim() || undefined,
      contact_email: raw.contact_email?.trim() || undefined,
      contact_phone: raw.contact_phone?.trim() || undefined,
      notes: raw.notes?.trim() || undefined,
    });
  });

  return { rows, errors };
}
