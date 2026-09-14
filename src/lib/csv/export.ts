import Papa from "papaparse";

export type JobExportRow = {
  job_number: string;
  status: string;
  job_type: string;
  priority: string | null;
  customer: string;
  site: string;
  project: string;
  assigned_to: string;
  scheduled_start: string | null;
};

const COLUMNS = [
  "job_number",
  "status",
  "job_type",
  "priority",
  "customer",
  "site",
  "project",
  "assigned_to",
  "scheduled_start",
];

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

export type TimesheetExportRow = {
  job_number: string;
  engineer: string;
  customer: string;
  site: string;
  date: string | null;
  travel_minutes: number | null;
  work_minutes: number | null;
  total_minutes: number | null;
};

const TIMESHEET_COLUMNS = [
  "job_number",
  "engineer",
  "customer",
  "site",
  "date",
  "travel_minutes",
  "work_minutes",
  "total_minutes",
];

/** Same Papa.unparse({fields, data}) shape as jobsToCsv, for the same reason (a zero-row filtered export still gets a header row). */
export function timesheetsToCsv(rows: TimesheetExportRow[]): string {
  return Papa.unparse({ fields: TIMESHEET_COLUMNS, data: rows });
}
