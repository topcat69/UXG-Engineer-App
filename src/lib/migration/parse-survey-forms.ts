import type { Database } from "@/lib/supabase/database.types";
import { lookupId, optionalText, parseCsvRows, parseOptionalBoolean, parseOptionalTimestamp, type ParseResult } from "./csv-helpers";

export type SurveyFormInsert = Database["public"]["Tables"]["survey_forms"]["Insert"];

export type SurveyFormImportRow = {
  jobNumber: string;
  mounting_surface?: string;
  power_available?: boolean;
  network_available?: boolean;
  access_restrictions?: string;
  measurements?: string;
  engineer_notes?: string;
  submitted_at?: string;
};

/** Required column: `job_number` (resolved to `job_id` by `resolveSurveyFormRows`). One row per job — `survey_forms.job_id` is unique. */
export function parseSurveyFormsCsv(text: string): ParseResult<SurveyFormImportRow> {
  const { data, errors: parseErrors } = parseCsvRows(text);
  const errors = [...parseErrors];
  const rows: SurveyFormImportRow[] = [];

  data.forEach((raw, index) => {
    const rowNumber = index + 2;
    const jobNumber = raw.job_number?.trim();
    if (!jobNumber) {
      errors.push(`Row ${rowNumber}: missing required "job_number" column`);
      return;
    }
    rows.push({
      jobNumber,
      mounting_surface: optionalText(raw.mounting_surface),
      power_available: parseOptionalBoolean(raw.power_available),
      network_available: parseOptionalBoolean(raw.network_available),
      access_restrictions: optionalText(raw.access_restrictions),
      measurements: optionalText(raw.measurements),
      engineer_notes: optionalText(raw.engineer_notes),
      submitted_at: parseOptionalTimestamp(raw.submitted_at, "submitted_at", rowNumber, errors),
    });
  });

  return { rows, errors };
}

export function resolveSurveyFormRows(rows: SurveyFormImportRow[], jobLookup: Map<string, string>): ParseResult<SurveyFormInsert> {
  const errors: string[] = [];
  const resolved: SurveyFormInsert[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const jobId = lookupId(jobLookup, row.jobNumber);
    if (!jobId) {
      errors.push(`Row ${rowNumber}: unknown job_number "${row.jobNumber}"`);
      return;
    }
    resolved.push({
      job_id: jobId,
      mounting_surface: row.mounting_surface,
      power_available: row.power_available,
      network_available: row.network_available,
      access_restrictions: row.access_restrictions,
      measurements: row.measurements,
      engineer_notes: row.engineer_notes,
      submitted_at: row.submitted_at,
    });
  });

  return { rows: resolved, errors };
}
