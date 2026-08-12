import { describe, expect, it } from "vitest";
import {
  buildIssueColumnValues,
  buildIssueDescription,
  buildIssueItemName,
  type MondayIssue,
  type MondayIssueJob,
} from "./issue-payload";

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

describe("buildIssueDescription", () => {
  it("leads with the raw description, then the job number", () => {
    const description = buildIssueDescription(issue, job);
    expect(description).toContain("Screen won't power on after mount");
    expect(description).toContain("Job: UXG-2026-0042");
  });

  it("includes 'Reported by' when a name is given, omits it otherwise", () => {
    expect(buildIssueDescription(issue, job, "Jamie Vance")).toContain("Reported by: Jamie Vance");
    expect(buildIssueDescription(issue, job, null)).not.toContain("Reported by");
    expect(buildIssueDescription(issue, job)).not.toContain("Reported by");
  });

  it("includes the category when present, omits it when null", () => {
    expect(buildIssueDescription(issue, job)).toContain("Category: install");
    expect(buildIssueDescription({ ...issue, category: null }, job)).not.toContain("Category");
  });

  it("flags blocks_completion only when true", () => {
    expect(buildIssueDescription({ ...issue, blocks_completion: true }, job)).toContain("Blocks completion: yes");
    expect(buildIssueDescription({ ...issue, blocks_completion: false }, job)).not.toContain("Blocks completion");
  });
});

describe("buildIssueColumnValues", () => {
  it("puts the full structured description into the Description column", () => {
    const values = buildIssueColumnValues(issue, job, "Jamie Vance");
    expect(values.text_mm65r8tx).toBe(buildIssueDescription(issue, job, "Jamie Vance"));
  });

  it.each([
    ["low", "Low"],
    ["medium", "Medium"],
    ["high", "High"],
    ["critical", "Critical"],
  ])("maps severity '%s' to the board's dropdown label '%s'", (severity, label) => {
    const values = buildIssueColumnValues({ ...issue, severity }, job);
    expect(values.dropdown_mm65mv1z).toEqual({ labels: [label] });
  });

  it("defaults to 'Medium' severity for an unrecognised value rather than failing", () => {
    const values = buildIssueColumnValues({ ...issue, severity: "unknown" }, job);
    expect(values.dropdown_mm65mv1z).toEqual({ labels: ["Medium"] });
  });

  it("maps status 'open'/'resolved' to the board's Status labels, defaulting to Open", () => {
    expect(buildIssueColumnValues({ ...issue, status: "open" }, job).color_mm65tva9).toEqual({ label: "Open" });
    expect(buildIssueColumnValues({ ...issue, status: "resolved" }, job).color_mm65tva9).toEqual({
      label: "Resolved",
    });
    expect(buildIssueColumnValues({ ...issue, status: null }, job).color_mm65tva9).toEqual({ label: "Open" });
  });

  it("formats Reported Date as YYYY-MM-DD from the issue's created_at", () => {
    const values = buildIssueColumnValues(issue, job);
    expect(values.date_mm65dpd3).toEqual({ date: "2026-08-10" });
  });

  it("omits Reported Date when created_at is unknown", () => {
    const values = buildIssueColumnValues({ ...issue, created_at: null }, job);
    expect(values.date_mm65dpd3).toBeUndefined();
  });
});
