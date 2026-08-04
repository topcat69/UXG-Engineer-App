import { describe, expect, it } from "vitest";
import { buildLookup } from "./csv-helpers";
import { parseSurveyFormsCsv, resolveSurveyFormRows } from "./parse-survey-forms";

describe("parseSurveyFormsCsv / resolveSurveyFormRows", () => {
  it("resolves a known job_number", () => {
    const { rows } = parseSurveyFormsCsv("job_number,power_available\nJOB-1,true");
    const { rows: resolved, errors } = resolveSurveyFormRows(rows, buildLookup([{ key: "JOB-1", id: "job-1" }]));
    expect(errors).toEqual([]);
    expect(resolved[0]).toMatchObject({ job_id: "job-1", power_available: true });
  });

  it("errors when job_number doesn't resolve", () => {
    const { rows } = parseSurveyFormsCsv("job_number\nJOB-404");
    const { rows: resolved, errors } = resolveSurveyFormRows(rows, buildLookup([]));
    expect(resolved).toEqual([]);
    expect(errors).toEqual(['Row 2: unknown job_number "JOB-404"']);
  });
});
