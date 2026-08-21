import { describe, expect, it } from "vitest";
import { groupIssuesByJob, type IssueForGrouping } from "./group-by-job";

function issue(overrides: Partial<IssueForGrouping>): IssueForGrouping {
  return {
    id: "issue-1",
    severity: "medium",
    blocks_completion: false,
    category: null,
    created_at: "2026-08-19T09:00:00.000Z",
    description: "Something went wrong.",
    raised_by_user: { name: "Engineer Test" },
    job: { id: "job-1", job_number: "UXG-2026-0007", status: "draft" },
    site: { name: "Liverpool One" },
    revisit_job: null,
    ...overrides,
  };
}

describe("groupIssuesByJob", () => {
  it("collapses multiple issues on the same job into one group", () => {
    const groups = groupIssuesByJob([
      issue({ id: "a", description: "Content not displaying on screen." }),
      issue({ id: "b", description: "Revisit required (flagged by engineer)." }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].jobId).toBe("job-1");
    expect(groups[0].issues.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("keeps issues on different jobs as separate groups", () => {
    const groups = groupIssuesByJob([
      issue({ id: "a", job: { id: "job-1", job_number: "UXG-2026-0007", status: "draft" } }),
      issue({ id: "b", job: { id: "job-2", job_number: "UXG-2026-0008", status: "submitted" } }),
    ]);
    expect(groups).toHaveLength(2);
  });

  it("sorts groups by their most severe issue, not by first-seen order", () => {
    const groups = groupIssuesByJob([
      issue({ id: "a", severity: "low", job: { id: "job-low", job_number: "UXG-1", status: "draft" } }),
      issue({ id: "b", severity: "critical", job: { id: "job-critical", job_number: "UXG-2", status: "draft" } }),
      issue({ id: "c", severity: "medium", job: { id: "job-medium", job_number: "UXG-3", status: "draft" } }),
    ]);
    expect(groups.map((g) => g.jobId)).toEqual(["job-critical", "job-medium", "job-low"]);
  });

  it("a job's group takes its worst severity even when a later issue on it is less severe", () => {
    const groups = groupIssuesByJob([
      issue({ id: "a", severity: "low" }),
      issue({ id: "b", severity: "critical" }),
    ]);
    expect(groups[0].worstSeverityRank).toBe(0);
  });

  it("drops issues with no job attached", () => {
    const groups = groupIssuesByJob([issue({ id: "a", job: null })]);
    expect(groups).toHaveLength(0);
  });

  it("keeps the first non-null revisit job seen for the group", () => {
    const revisit = { id: "revisit-1", job_number: "UXG-2026-0009" };
    const groups = groupIssuesByJob([
      issue({ id: "a", revisit_job: null }),
      issue({ id: "b", revisit_job: revisit }),
    ]);
    expect(groups[0].revisitJob).toEqual(revisit);
  });
});
