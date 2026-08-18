import type { Database } from "@/lib/supabase/database.types";
import { optionalText, parseCsvRows, type ParseResult } from "./csv-helpers";

export type ProjectInsert = Database["public"]["Tables"]["projects"]["Insert"];

/**
 * Required column: `name`. Matches our own `projects` table shape 1:1 — this
 * schema deliberately mirrors the AppSheet app's, per PROMPT.md.
 *
 * No longer imports `client_name` — projects dropped that column (see
 * 20260116000000_clients.sql) once Client became a proper entity, since a
 * project can span many clients rather than belonging to just one. An
 * AppSheet export's per-project client name has no single place to land
 * here any more; if this script is ever run again, mapping it onto real
 * Client/Site rows is a decision for whoever's running that migration, not
 * something this parser can infer on its own.
 */
export function parseProjectsCsv(text: string): ParseResult<ProjectInsert> {
  const { data, errors: parseErrors } = parseCsvRows(text);
  const errors = [...parseErrors];
  const rows: ProjectInsert[] = [];

  data.forEach((raw, index) => {
    const rowNumber = index + 2;
    const name = raw.name?.trim();
    if (!name) {
      errors.push(`Row ${rowNumber}: missing required "name" column`);
      return;
    }
    rows.push({
      name,
      start_date: optionalText(raw.start_date),
      end_date: optionalText(raw.end_date),
      status: optionalText(raw.status),
    });
  });

  return { rows, errors };
}
