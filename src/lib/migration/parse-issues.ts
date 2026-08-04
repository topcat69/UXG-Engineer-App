import type { Database } from "@/lib/supabase/database.types";
import { lookupId, optionalText, parseCsvRows, parseOptionalBoolean, parseOptionalTimestamp, type ParseResult } from "./csv-helpers";

export type IssueInsert = Database["public"]["Tables"]["issues"]["Insert"];

export type IssueImportRow = {
  jobNumber?: string;
  siteName?: string;
  raisedByEmail?: string;
  severity: string;
  category?: string;
  description: string;
  blocks_completion?: boolean;
  status?: string;
  resolved_at?: string;
  createdAt?: string;
};

/** Required columns: `severity`, `description` — matches the schema's own not-null columns. `job_number`/`site_name`/`raised_by_email` are natural keys, resolved by `resolveIssueRows`. */
export function parseIssuesCsv(text: string): ParseResult<IssueImportRow> {
  const { data, errors: parseErrors } = parseCsvRows(text);
  const errors = [...parseErrors];
  const rows: IssueImportRow[] = [];

  data.forEach((raw, index) => {
    const rowNumber = index + 2;
    const severity = raw.severity?.trim();
    const description = raw.description?.trim();
    if (!severity) {
      errors.push(`Row ${rowNumber}: missing required "severity" column`);
      return;
    }
    if (!description) {
      errors.push(`Row ${rowNumber}: missing required "description" column`);
      return;
    }
    rows.push({
      jobNumber: optionalText(raw.job_number),
      siteName: optionalText(raw.site_name),
      raisedByEmail: optionalText(raw.raised_by_email)?.toLowerCase(),
      severity,
      category: optionalText(raw.category),
      description,
      blocks_completion: parseOptionalBoolean(raw.blocks_completion),
      status: optionalText(raw.status),
      resolved_at: parseOptionalTimestamp(raw.resolved_at, "resolved_at", rowNumber, errors),
      createdAt: parseOptionalTimestamp(raw.created_at, "created_at", rowNumber, errors),
    });
  });

  return { rows, errors };
}

export function resolveIssueRows(
  rows: IssueImportRow[],
  jobLookup: Map<string, string>,
  siteLookup: Map<string, string>,
  userLookup: Map<string, string>,
): ParseResult<IssueInsert> {
  const errors: string[] = [];
  const resolved: IssueInsert[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const jobId = row.jobNumber ? lookupId(jobLookup, row.jobNumber) : undefined;
    if (row.jobNumber && !jobId) {
      errors.push(`Row ${rowNumber}: unknown job_number "${row.jobNumber}"`);
      return;
    }
    const siteId = row.siteName ? lookupId(siteLookup, row.siteName) : undefined;
    if (row.siteName && !siteId) {
      errors.push(`Row ${rowNumber}: unknown site "${row.siteName}"`);
      return;
    }
    const raisedBy = row.raisedByEmail ? lookupId(userLookup, row.raisedByEmail) : undefined;
    if (row.raisedByEmail && !raisedBy) {
      errors.push(`Row ${rowNumber}: unknown raised_by_email "${row.raisedByEmail}"`);
      return;
    }

    resolved.push({
      job_id: jobId,
      site_id: siteId,
      raised_by: raisedBy,
      severity: row.severity,
      category: row.category,
      description: row.description,
      blocks_completion: row.blocks_completion,
      status: row.status,
      resolved_at: row.resolved_at,
      created_at: row.createdAt,
    });
  });

  return { rows: resolved, errors };
}
