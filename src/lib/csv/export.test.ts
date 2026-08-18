import { describe, expect, it } from "vitest";
import { jobsToCsv, type JobExportRow } from "./export";

const row: JobExportRow = {
  job_number: "UXG-2026-0001",
  status: "closed",
  job_type: "install",
  priority: "P1",
  client: "Acme Retail",
  site: "Riverside Retail Park",
  project: "Acme Rollout",
  assigned_to: "Jamie Vance",
  scheduled_start: "2026-08-10T09:00:00.000Z",
};

describe("jobsToCsv", () => {
  it("produces a header row followed by one data row", () => {
    const csv = jobsToCsv([row]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("job_number,status,job_type,priority,client,site,project,assigned_to,scheduled_start");
    expect(lines[1]).toContain("UXG-2026-0001");
  });

  it("quotes a field containing a comma", () => {
    const csv = jobsToCsv([{ ...row, site: "Riverside, Retail Park" }]);
    expect(csv).toContain('"Riverside, Retail Park"');
  });

  it("escapes an embedded double quote", () => {
    const csv = jobsToCsv([{ ...row, project: 'Acme "Big" Rollout' }]);
    expect(csv).toContain('"Acme ""Big"" Rollout"');
  });

  it("returns just a header line for an empty result set, not an error", () => {
    const csv = jobsToCsv([]);
    expect(csv.trim()).toBe("job_number,status,job_type,priority,client,site,project,assigned_to,scheduled_start");
  });
});
