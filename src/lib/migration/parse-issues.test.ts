import { describe, expect, it } from "vitest";
import { buildLookup } from "./csv-helpers";
import { parseIssuesCsv, resolveIssueRows } from "./parse-issues";

describe("parseIssuesCsv", () => {
  it("requires severity and description", () => {
    const { rows, errors } = parseIssuesCsv("severity,description\n,");
    expect(rows).toEqual([]);
    expect(errors).toEqual(['Row 2: missing required "severity" column']);
  });

  it("parses natural-key columns for later resolution", () => {
    const { rows, errors } = parseIssuesCsv(
      "severity,description,job_number,site_name,raised_by_email\nhigh,Screen cracked,JOB-1,Main Store,Alice@Example.com",
    );
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ jobNumber: "JOB-1", siteName: "Main Store", raisedByEmail: "alice@example.com" });
  });
});

describe("resolveIssueRows", () => {
  it("resolves job, site, and raised_by, and allows all three to be blank", () => {
    const { rows } = parseIssuesCsv("severity,description\nhigh,No linkage");
    const { rows: resolved, errors } = resolveIssueRows(rows, buildLookup([]), buildLookup([]), buildLookup([]));
    expect(errors).toEqual([]);
    expect(resolved[0]).toMatchObject({ job_id: undefined, site_id: undefined, raised_by: undefined });
  });

  it("errors on an unresolvable job_number", () => {
    const { rows } = parseIssuesCsv("severity,description,job_number\nhigh,x,JOB-404");
    const { rows: resolved, errors } = resolveIssueRows(rows, buildLookup([]), buildLookup([]), buildLookup([]));
    expect(resolved).toEqual([]);
    expect(errors).toEqual(['Row 2: unknown job_number "JOB-404"']);
  });
});
