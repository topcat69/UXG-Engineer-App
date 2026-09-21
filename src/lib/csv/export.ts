import Papa from "papaparse";
import type { SlaJobRow } from "@/lib/reports/sla-compliance-data";
import type { ProjectRollupJobRow } from "@/lib/reports/project-rollup-data";

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

const SLA_COMPLIANCE_COLUMNS = ["job_number", "customer", "site", "fixture_type", "engineer", "target_hours", "actual_hours", "outcome"];

/** Flat per-job line list, matching the report page's own "Jobs" table — same row shape the PDF/XLSX job list uses. */
export function slaComplianceToCsv(rows: SlaJobRow[]): string {
  const data = rows.map((r) => ({
    job_number: r.jobNumber,
    customer: r.clientName,
    site: r.siteName,
    fixture_type: r.fixtureTypeName,
    engineer: r.engineerName,
    target_hours: r.targetHours,
    actual_hours: r.durationHours == null ? null : Number(r.durationHours.toFixed(1)),
    outcome: r.outcome,
  }));
  return Papa.unparse({ fields: SLA_COMPLIANCE_COLUMNS, data });
}

const PROJECT_ROLLUP_COLUMNS = ["job_number", "site", "status", "engineer", "scheduled_start"];

/** Flat per-job line list, matching the report page's own "Jobs" table. */
export function projectRollupToCsv(rows: ProjectRollupJobRow[]): string {
  const data = rows.map((r) => ({
    job_number: r.jobNumber,
    site: r.siteName,
    status: r.status,
    engineer: r.engineerName,
    scheduled_start: r.scheduledStart,
  }));
  return Papa.unparse({ fields: PROJECT_ROLLUP_COLUMNS, data });
}
