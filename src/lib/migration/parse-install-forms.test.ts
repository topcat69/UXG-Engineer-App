import { describe, expect, it } from "vitest";
import { buildLookup } from "./csv-helpers";
import { parseInstallFormsCsv, resolveInstallFormRows } from "./parse-install-forms";

describe("parseInstallFormsCsv / resolveInstallFormRows", () => {
  it("resolves a known job_number and validates pass_fail columns", () => {
    const csv = "job_number,player_boot_test,content_displaying\nJOB-1,Pass,Fail";
    const { rows, errors } = parseInstallFormsCsv(csv);
    expect(errors).toEqual([]);
    const { rows: resolved, errors: resolveErrors } = resolveInstallFormRows(rows, buildLookup([{ key: "JOB-1", id: "job-1" }]));
    expect(resolveErrors).toEqual([]);
    expect(resolved).toEqual([{
      job_id: "job-1",
      player_serial: undefined, screen_serial: undefined, mount_type: undefined,
      power_source: undefined, network_type: undefined, wifi_signal: undefined,
      player_boot_test: "pass", content_displaying: "fail",
      issues_found: undefined, issue_detail: undefined, engineer_notes: undefined,
      client_name: undefined, submitted_at: undefined,
    }]);
  });

  it("rejects an unrecognised pass_fail value", () => {
    const { errors } = parseInstallFormsCsv("job_number,player_boot_test\nJOB-1,maybe");
    expect(errors[0]).toMatch(/unrecognised player_boot_test/);
  });

  it("errors when job_number doesn't resolve", () => {
    const { rows } = parseInstallFormsCsv("job_number\nJOB-404");
    const { rows: resolved, errors } = resolveInstallFormRows(rows, buildLookup([]));
    expect(resolved).toEqual([]);
    expect(errors).toEqual(['Row 2: unknown job_number "JOB-404"']);
  });
});
