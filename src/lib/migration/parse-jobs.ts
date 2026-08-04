import type { Database } from "@/lib/supabase/database.types";
import {
  lookupId,
  optionalText,
  parseCsvRows,
  parseEnum,
  parseOptionalTimestamp,
  type ParseResult,
} from "./csv-helpers";

export type JobInsert = Database["public"]["Tables"]["jobs"]["Insert"];
type JobStatus = Database["public"]["Enums"]["job_status"];

const JOB_STATUSES: readonly JobStatus[] = [
  "draft", "scheduled", "dispatched", "accepted", "travelling", "on_site",
  "in_progress", "submitted", "under_review", "approved", "closed",
  "on_hold", "cancelled",
];

/** Intermediate shape: `project_name`/`site_name`/`assigned_to_email` are natural keys resolved by `resolveJobRows`. */
export type JobImportRow = {
  job_number: string;
  projectName?: string;
  siteName: string;
  job_type: string;
  status?: JobStatus;
  priority?: string;
  assignedToEmail?: string;
  scheduled_start?: string;
  scheduled_end?: string;
  actual_start?: string;
  actual_end?: string;
  description?: string;
  createdAt?: string;
};

/**
 * Required columns: `job_number`, `site_name`, `job_type`. `status`
 * defaults to "draft" (the schema's own default) when blank, but an
 * unrecognised non-blank status is a row error, not a silent fallback —
 * a job whose AppSheet status doesn't map cleanly onto ours needs a human
 * to look at it, not to be quietly imported as a fresh draft.
 */
export function parseJobsCsv(text: string): ParseResult<JobImportRow> {
  const { data, errors: parseErrors } = parseCsvRows(text);
  const errors = [...parseErrors];
  const rows: JobImportRow[] = [];
  const seenJobNumbers = new Set<string>();

  data.forEach((raw, index) => {
    const rowNumber = index + 2;
    const jobNumber = raw.job_number?.trim();
    const siteName = raw.site_name?.trim();
    const jobType = raw.job_type?.trim();

    if (!jobNumber) {
      errors.push(`Row ${rowNumber}: missing required "job_number" column`);
      return;
    }
    if (seenJobNumbers.has(jobNumber)) {
      errors.push(`Row ${rowNumber}: duplicate job_number "${jobNumber}" in this file`);
      return;
    }
    if (!siteName) {
      errors.push(`Row ${rowNumber}: missing required "site_name" column`);
      return;
    }
    if (!jobType) {
      errors.push(`Row ${rowNumber}: missing required "job_type" column`);
      return;
    }
    seenJobNumbers.add(jobNumber);

    rows.push({
      job_number: jobNumber,
      projectName: optionalText(raw.project_name),
      siteName,
      job_type: jobType,
      status: parseEnum(raw.status, JOB_STATUSES, "status", rowNumber, errors),
      priority: optionalText(raw.priority),
      assignedToEmail: optionalText(raw.assigned_to_email)?.toLowerCase(),
      scheduled_start: parseOptionalTimestamp(raw.scheduled_start, "scheduled_start", rowNumber, errors),
      scheduled_end: parseOptionalTimestamp(raw.scheduled_end, "scheduled_end", rowNumber, errors),
      actual_start: parseOptionalTimestamp(raw.actual_start, "actual_start", rowNumber, errors),
      actual_end: parseOptionalTimestamp(raw.actual_end, "actual_end", rowNumber, errors),
      description: optionalText(raw.description),
      createdAt: parseOptionalTimestamp(raw.created_at, "created_at", rowNumber, errors),
    });
  });

  return { rows, errors };
}

export function resolveJobRows(
  rows: JobImportRow[],
  siteLookup: Map<string, string>,
  projectLookup: Map<string, string>,
  userLookup: Map<string, string>,
): ParseResult<JobInsert> {
  const errors: string[] = [];
  const resolved: JobInsert[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const siteId = lookupId(siteLookup, row.siteName);
    if (!siteId) {
      errors.push(`Row ${rowNumber}: unknown site "${row.siteName}" for job ${row.job_number}`);
      return;
    }
    const projectId = row.projectName ? lookupId(projectLookup, row.projectName) : undefined;
    if (row.projectName && !projectId) {
      errors.push(`Row ${rowNumber}: unknown project "${row.projectName}" for job ${row.job_number}`);
      return;
    }
    const assignedTo = row.assignedToEmail ? lookupId(userLookup, row.assignedToEmail) : undefined;
    if (row.assignedToEmail && !assignedTo) {
      errors.push(`Row ${rowNumber}: unknown assigned_to_email "${row.assignedToEmail}" for job ${row.job_number}`);
      return;
    }

    resolved.push({
      job_number: row.job_number,
      project_id: projectId,
      site_id: siteId,
      job_type: row.job_type,
      status: row.status ?? "draft",
      priority: row.priority,
      assigned_to: assignedTo,
      scheduled_start: row.scheduled_start,
      scheduled_end: row.scheduled_end,
      actual_start: row.actual_start,
      actual_end: row.actual_end,
      description: row.description,
      created_at: row.createdAt,
    });
  });

  return { rows: resolved, errors };
}
