import { describe, expect, it } from "vitest";
import { buildIssueColumnValues, buildIssueItemName, type MondayIssue, type MondayIssueJob } from "./issue-payload";

const issue: MondayIssue = {
  severity: "high",
  category: "install",
  description: "Screen won't power on after mount",
  blocks_completion: false,
  status: "open",
  created_at: "2026-08-10T09:15:00.000Z",
};

const job: MondayIssueJob = { job_number: "UXG-2026-0042" };

describe("buildIssueItemName", () => {
  it("names the item '{job_number}: {description}'", () => {
    expect(buildIssueItemName(issue, job)).toBe("UXG-2026-0042: Screen won't power on after mount");
  });

  it("truncates long descriptions rather than exceeding Monday's item name limit", () => {
    const longIssue = { ...issue, description: "x".repeat(250) };
    const name = buildIssueItemName(longIssue, job);
    expect(name.length).toBe(200);
    expect(name.endsWith("...")).toBe(true);
  });
});

describe("buildIssueColumnValues", () => {
  it("carries the job number into the Job Reference column", () => {
    const values = buildIssueColumnValues(issue, job);
    expect(values.text_mm5x44h9).toBe("UXG-2026-0042");
  });

  it.each([
    ["low", "Low"],
    ["medium", "Medium"],
    ["high", "High"],
    ["critical", "Critical"],
  ])("maps severity '%s' to the board label '%s'", (severity, label) => {
    const values = buildIssueColumnValues({ ...issue, severity }, job);
    expect(values.color_mm5xg295).toEqual({ label });
  });

  it("defaults to 'Medium' severity for an unrecognised value rather than failing", () => {
    const values = buildIssueColumnValues({ ...issue, severity: "unknown" }, job);
    expect(values.color_mm5xg295).toEqual({ label: "Medium" });
  });

  it("maps status 'open'/'resolved' to the board's Status labels, defaulting to Open", () => {
    expect(buildIssueColumnValues({ ...issue, status: "open" }, job).color_mm5x1wcq).toEqual({ label: "Open" });
    expect(buildIssueColumnValues({ ...issue, status: "resolved" }, job).color_mm5x1wcq).toEqual({ label: "Resolved" });
    expect(buildIssueColumnValues({ ...issue, status: null }, job).color_mm5x1wcq).toEqual({ label: "Open" });
  });

  it("formats Date Raised as YYYY-MM-DD from the issue's created_at", () => {
    const values = buildIssueColumnValues(issue, job);
    expect(values.date_mm5xn22e).toEqual({ date: "2026-08-10" });
  });

  it("omits Date Raised when created_at is unknown", () => {
    const values = buildIssueColumnValues({ ...issue, created_at: null }, job);
    expect(values.date_mm5xn22e).toBeUndefined();
  });

  it.each([
    ["connectivity dropout", "Connectivity Issue"],
    ["no site access", "Site Access Issue"],
    ["equipment missing from van", "Equipment Missing"],
    ["customer moved the unit", "Customer Damage"],
    ["cracked screen", "Damaged Screen"],
    ["damaged mounting fixture", "Damaged Fixture"],
    ["something unclassifiable", "Other"],
  ])("maps category '%s' to Issue Type '%s' by keyword", (category, label) => {
    const values = buildIssueColumnValues({ ...issue, category, blocks_completion: false }, job);
    expect(values.dropdown_mm5xbd).toEqual({ labels: [label] });
  });

  it("maps a null category to 'Other' rather than failing", () => {
    const values = buildIssueColumnValues({ ...issue, category: null }, job);
    expect(values.dropdown_mm5xbd).toEqual({ labels: ["Other"] });
  });

  it("maps Issue Type to 'Revisit Required' whenever blocks_completion is set, regardless of category", () => {
    const values = buildIssueColumnValues({ ...issue, category: "cracked screen", blocks_completion: true }, job);
    expect(values.dropdown_mm5xbd).toEqual({ labels: ["Revisit Required"] });
  });

  it("sets Reported By to the resolved Monday.com user when one was found", () => {
    const values = buildIssueColumnValues(issue, job, 12345678);
    expect(values.multiple_person_mm5xsats).toEqual({ personsAndTeams: [{ id: 12345678, kind: "person" }] });
  });

  it.each([undefined, null])("omits Reported By rather than guessing when the lookup found no match (%s)", (id) => {
    const values = buildIssueColumnValues(issue, job, id);
    expect(values.multiple_person_mm5xsats).toBeUndefined();
  });
});
