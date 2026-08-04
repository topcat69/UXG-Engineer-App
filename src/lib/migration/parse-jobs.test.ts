import { describe, expect, it } from "vitest";
import { buildLookup } from "./csv-helpers";
import { parseJobsCsv, resolveJobRows } from "./parse-jobs";

describe("parseJobsCsv", () => {
  it("parses a valid row and defaults status to draft when blank", () => {
    const csv = "job_number,site_name,job_type\nJOB-1,Main Store,install";
    const { rows, errors } = parseJobsCsv(csv);
    expect(errors).toEqual([]);
    expect(rows[0].status).toBeUndefined(); // resolved to "draft" only at resolve time
  });

  it("preserves a historical status and created_at rather than resetting them", () => {
    const csv = "job_number,site_name,job_type,status,created_at\nJOB-1,Main Store,install,closed,2024-03-01T09:00:00Z";
    const { rows, errors } = parseJobsCsv(csv);
    expect(errors).toEqual([]);
    expect(rows[0].status).toBe("closed");
    expect(rows[0].createdAt).toBe("2024-03-01T09:00:00.000Z");
  });

  it("rejects an unrecognised status", () => {
    const csv = "job_number,site_name,job_type,status\nJOB-1,Main Store,install,archived";
    const { rows, errors } = parseJobsCsv(csv);
    expect(rows[0].status).toBeUndefined();
    expect(errors[0]).toMatch(/unrecognised status/);
  });

  it("rejects duplicate job_number within the same file", () => {
    const csv = "job_number,site_name,job_type\nJOB-1,Main Store,install\nJOB-1,Other Site,survey";
    const { rows, errors } = parseJobsCsv(csv);
    expect(rows).toHaveLength(1);
    expect(errors).toEqual(['Row 3: duplicate job_number "JOB-1" in this file']);
  });

  it("requires job_number, site_name, and job_type", () => {
    const csv = "job_number,site_name,job_type\n,,";
    const { rows, errors } = parseJobsCsv(csv);
    expect(rows).toEqual([]);
    expect(errors).toEqual(['Row 2: missing required "job_number" column']);
  });
});

describe("resolveJobRows", () => {
  const siteLookup = buildLookup([{ key: "Main Store", id: "site-1" }]);
  const projectLookup = buildLookup([{ key: "Rollout", id: "project-1" }]);
  const userLookup = buildLookup([{ key: "alice@example.com", id: "user-1" }]);

  it("resolves site, project, and assigned_to by natural key", () => {
    const { rows } = parseJobsCsv("job_number,site_name,job_type,project_name,assigned_to_email\nJOB-1,Main Store,install,Rollout,alice@example.com");
    const { rows: resolved, errors } = resolveJobRows(rows, siteLookup, projectLookup, userLookup);
    expect(errors).toEqual([]);
    expect(resolved[0]).toMatchObject({ site_id: "site-1", project_id: "project-1", assigned_to: "user-1", status: "draft" });
  });

  it("errors when the site is unknown", () => {
    const { rows } = parseJobsCsv("job_number,site_name,job_type\nJOB-1,Ghost Site,install");
    const { rows: resolved, errors } = resolveJobRows(rows, siteLookup, projectLookup, userLookup);
    expect(resolved).toEqual([]);
    expect(errors[0]).toMatch(/unknown site/);
  });
});
