import type { Database } from "@/lib/supabase/database.types";
import { lookupId, optionalText, parseCsvRows, parseEnum, parseOptionalBoolean, parseOptionalTimestamp, type ParseResult } from "./csv-helpers";

export type InstallFormInsert = Database["public"]["Tables"]["install_forms"]["Insert"];
type PassFail = Database["public"]["Enums"]["pass_fail"];
const PASS_FAIL: readonly PassFail[] = ["pass", "fail", "na"];

export type InstallFormImportRow = {
  jobNumber: string;
  player_serial?: string;
  screen_serial?: string;
  mount_type?: string;
  power_source?: string;
  network_type?: string;
  wifi_signal?: string;
  player_boot_test?: PassFail;
  content_displaying?: PassFail;
  issues_found?: boolean;
  issue_detail?: string;
  engineer_notes?: string;
  client_name?: string;
  submitted_at?: string;
};

/** Required column: `job_number` (resolved to `job_id` by `resolveInstallFormRows`). One row per job — `install_forms.job_id` is unique. */
export function parseInstallFormsCsv(text: string): ParseResult<InstallFormImportRow> {
  const { data, errors: parseErrors } = parseCsvRows(text);
  const errors = [...parseErrors];
  const rows: InstallFormImportRow[] = [];

  data.forEach((raw, index) => {
    const rowNumber = index + 2;
    const jobNumber = raw.job_number?.trim();
    if (!jobNumber) {
      errors.push(`Row ${rowNumber}: missing required "job_number" column`);
      return;
    }
    rows.push({
      jobNumber,
      player_serial: optionalText(raw.player_serial),
      screen_serial: optionalText(raw.screen_serial),
      mount_type: optionalText(raw.mount_type),
      power_source: optionalText(raw.power_source),
      network_type: optionalText(raw.network_type),
      wifi_signal: optionalText(raw.wifi_signal),
      player_boot_test: parseEnum(raw.player_boot_test, PASS_FAIL, "player_boot_test", rowNumber, errors),
      content_displaying: parseEnum(raw.content_displaying, PASS_FAIL, "content_displaying", rowNumber, errors),
      issues_found: parseOptionalBoolean(raw.issues_found),
      issue_detail: optionalText(raw.issue_detail),
      engineer_notes: optionalText(raw.engineer_notes),
      client_name: optionalText(raw.client_name),
      submitted_at: parseOptionalTimestamp(raw.submitted_at, "submitted_at", rowNumber, errors),
    });
  });

  return { rows, errors };
}

export function resolveInstallFormRows(rows: InstallFormImportRow[], jobLookup: Map<string, string>): ParseResult<InstallFormInsert> {
  const errors: string[] = [];
  const resolved: InstallFormInsert[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const jobId = lookupId(jobLookup, row.jobNumber);
    if (!jobId) {
      errors.push(`Row ${rowNumber}: unknown job_number "${row.jobNumber}"`);
      return;
    }
    resolved.push({
      job_id: jobId,
      player_serial: row.player_serial,
      screen_serial: row.screen_serial,
      mount_type: row.mount_type,
      power_source: row.power_source,
      network_type: row.network_type,
      wifi_signal: row.wifi_signal,
      player_boot_test: row.player_boot_test,
      content_displaying: row.content_displaying,
      issues_found: row.issues_found,
      issue_detail: row.issue_detail,
      engineer_notes: row.engineer_notes,
      client_name: row.client_name,
      submitted_at: row.submitted_at,
    });
  });

  return { rows: resolved, errors };
}
