import Papa from "papaparse";

export type JobExportRow = {
  job_number: string;
  status: string;
  job_type: string;
  priority: string | null;
  site: string;
  project: string;
  assigned_to: string;
  scheduled_start: string | null;
};

const COLUMNS = ["job_number", "status", "job_type", "priority", "site", "project", "assigned_to", "scheduled_start"];

/**
 * Papa.unparse already handles embedded commas/quotes/newlines correctly —
 * reusing it here rather than hand-rolling CSV escaping, which is exactly
 * the kind of thing worth not reinventing. Passed as `{data, fields}`
 * rather than a plain array with a `columns` option: Papa's unparse
 * ignores `columns` entirely for a *plain* empty array (a quirk in its own
 * unparse() branching), which would otherwise silently drop the header row
 * for a filtered export with zero matching jobs.
 */
export function jobsToCsv(rows: JobExportRow[]): string {
  return Papa.unparse({ fields: COLUMNS, data: rows });
}
