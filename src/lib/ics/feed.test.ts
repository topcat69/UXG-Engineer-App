import { describe, expect, it } from "vitest";
import { generateIcs, type IcsJob } from "./feed";

const job: IcsJob = {
  id: "job-1",
  job_number: "UXG-2026-0042",
  scheduled_start: "2026-08-10T09:00:00.000Z",
  scheduled_end: "2026-08-10T11:00:00.000Z",
  site_name: "Riverside Retail Park",
  site_address: "12 River Road, Leeds, LS1 4AB",
  cancelled: false,
};

describe("generateIcs", () => {
  it("wraps events in a valid VCALENDAR with the required header fields", () => {
    const ics = generateIcs("Jamie Vance", [job]);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("X-WR-CALNAME:Jamie Vance — UXG schedule");
  });

  it("emits one VEVENT per job with a UID stable across regenerations", () => {
    const ics = generateIcs("Jamie Vance", [job]);
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:job-job-1@uxgengineering");
    expect(ics).toContain("END:VEVENT");
  });

  it("formats start/end as basic UTC date-times", () => {
    const ics = generateIcs("Jamie Vance", [job]);
    expect(ics).toContain("DTSTART:20260810T090000Z");
    expect(ics).toContain("DTEND:20260810T110000Z");
  });

  it("titles the event '{job_number} — {site_name}' and sets LOCATION to the address", () => {
    const ics = generateIcs("Jamie Vance", [job]);
    expect(ics).toContain("SUMMARY:UXG-2026-0042 — Riverside Retail Park");
    expect(ics).toContain("LOCATION:12 River Road\\, Leeds\\, LS1 4AB");
  });

  it("marks cancelled jobs STATUS:CANCELLED instead of dropping them", () => {
    const ics = generateIcs("Jamie Vance", [{ ...job, cancelled: true }]);
    expect(ics).toContain("STATUS:CANCELLED");
  });

  it("falls back to the start time for DTEND when a job has no end time", () => {
    const ics = generateIcs("Jamie Vance", [{ ...job, scheduled_end: null }]);
    expect(ics).toContain("DTEND:20260810T090000Z");
  });

  it("escapes commas, semicolons, and backslashes in text fields", () => {
    const ics = generateIcs("Jamie Vance", [{ ...job, site_name: "Acme; Corp, Ltd\\HQ" }]);
    expect(ics).toContain("SUMMARY:UXG-2026-0042 — Acme\\; Corp\\, Ltd\\\\HQ");
  });

  it("produces an empty-but-valid calendar for an engineer with no jobs", () => {
    const ics = generateIcs("Jamie Vance", []);
    expect(ics).not.toContain("BEGIN:VEVENT");
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
  });
});
