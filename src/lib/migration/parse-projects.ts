import type { Database } from "@/lib/supabase/database.types";
import { optionalText, parseCsvRows, type ParseResult } from "./csv-helpers";

export type ProjectInsert = Database["public"]["Tables"]["projects"]["Insert"];

/** Required column: `name`. Matches our own `projects` table shape 1:1 — this schema deliberately mirrors the AppSheet app's, per PROMPT.md. */
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
      client_name: optionalText(raw.client_name),
      start_date: optionalText(raw.start_date),
      end_date: optionalText(raw.end_date),
      status: optionalText(raw.status),
    });
  });

  return { rows, errors };
}
