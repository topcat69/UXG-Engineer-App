import { describe, expect, it } from "vitest";
import {
  computeAverageTimeOnSiteMinutes,
  computeCompletedVsScheduled,
  computeEngineerWorkload,
  computeFirstTimeFixRate,
  computeOpenIssuesByAge,
  computeRevisitRateByCause,
  type DashboardIssue,
  type DashboardJob,
} from "./metrics";

function job(overrides: Partial<DashboardJob>): DashboardJob {
  return {
    id: crypto.randomUUID(),
    status: "closed",
    parent_job_id: null,
    scheduled_start: null,
    actual_start: null,
    actual_end: null,
    assigned_to: null,
    ...overrides,
  };
}

function issue(overrides: Partial<DashboardIssue>): DashboardIssue {
  return {
    job_id: crypto.randomUUID(),
    category: "install",
    status: "open",
    revisit_job_id: null,
    created_at: new Date().toISOString(),
    job: { status: "in_progress" },
    ...overrides,
  };
}

describe("computeFirstTimeFixRate", () => {
  it("counts a closed original job with no revisit as a first-time fix", () => {
    const jobs = [job({ id: "a", status: "closed", parent_job_id: null })];
    expect(computeFirstTimeFixRate(jobs)).toEqual({ rate: 1, firstTimeFixCount: 1, totalClosedOriginals: 1 });
  });

  it("excludes a closed original job that spawned a revisit", () => {
    const jobs = [
      job({ id: "a", status: "closed", parent_job_id: null }),
      job({ id: "b", status: "draft", parent_job_id: "a" }),
    ];
    expect(computeFirstTimeFixRate(jobs)).toEqual({ rate: 0, firstTimeFixCount: 0, totalClosedOriginals: 1 });
  });

  it("does not count a revisit job itself toward the denominator", () => {
    const jobs = [
      job({ id: "a", status: "closed", parent_job_id: null }),
      job({ id: "b", status: "closed", parent_job_id: "a" }), // the revisit, also closed
    ];
    // "a" spawned a revisit so it's not a first-time fix; "b" is a revisit,
    // not an original, so it's excluded from the denominator entirely.
    expect(computeFirstTimeFixRate(jobs)).toEqual({ rate: 0, firstTimeFixCount: 0, totalClosedOriginals: 1 });
  });

  it("returns a null rate rather than dividing by zero when nothing has closed yet", () => {
    const jobs = [job({ id: "a", status: "in_progress" })];
    expect(computeFirstTimeFixRate(jobs).rate).toBeNull();
  });

  it("mixed set produces the expected rate", () => {
    const jobs = [
      job({ id: "a", status: "closed" }), // first-time fix
      job({ id: "b", status: "closed" }), // spawns a revisit below
      job({ id: "c", parent_job_id: "b" }),
      job({ id: "d", status: "closed" }), // first-time fix
    ];
    expect(computeFirstTimeFixRate(jobs)).toEqual({ rate: 2 / 3, firstTimeFixCount: 2, totalClosedOriginals: 3 });
  });
});

describe("computeCompletedVsScheduled", () => {
  it("counts closed jobs as completed and scheduled-with-a-date jobs as scheduled", () => {
    const jobs = [
      job({ status: "closed" }),
      job({ status: "scheduled", scheduled_start: "2026-08-10T09:00:00Z" }),
      job({ status: "draft", scheduled_start: null }),
      job({ status: "cancelled", scheduled_start: "2026-08-11T09:00:00Z" }),
    ];
    expect(computeCompletedVsScheduled(jobs)).toEqual({ completed: 1, scheduled: 1 });
  });

  it("does not double-count a closed job as scheduled even though it still has a scheduled_start on file", () => {
    const jobs = [job({ status: "closed", scheduled_start: "2026-08-10T09:00:00Z" })];
    expect(computeCompletedVsScheduled(jobs)).toEqual({ completed: 1, scheduled: 0 });
  });

  it("moving a job from scheduled to closed shifts the counts in opposite directions", () => {
    const scheduledJob = job({ id: "a", status: "scheduled", scheduled_start: "2026-08-10T09:00:00Z" });
    const before = computeCompletedVsScheduled([scheduledJob]);
    const after = computeCompletedVsScheduled([{ ...scheduledJob, status: "closed" }]);
    expect(before).toEqual({ completed: 0, scheduled: 1 });
    expect(after).toEqual({ completed: 1, scheduled: 0 });
  });
});

describe("computeAverageTimeOnSiteMinutes", () => {
  it("averages actual_end - actual_start across jobs that have both", () => {
    const jobs = [
      job({ actual_start: "2026-08-10T09:00:00Z", actual_end: "2026-08-10T10:00:00Z" }), // 60 min
      job({ actual_start: "2026-08-10T09:00:00Z", actual_end: "2026-08-10T09:30:00Z" }), // 30 min
      job({ actual_start: null, actual_end: null }), // excluded
    ];
    expect(computeAverageTimeOnSiteMinutes(jobs)).toBe(45);
  });

  it("returns null when no job has both timestamps", () => {
    expect(computeAverageTimeOnSiteMinutes([job({})])).toBeNull();
  });

  it("ignores a negative duration (bad data) rather than skewing the average", () => {
    const jobs = [job({ actual_start: "2026-08-10T10:00:00Z", actual_end: "2026-08-10T09:00:00Z" })];
    expect(computeAverageTimeOnSiteMinutes(jobs)).toBeNull();
  });

  it("excludes a paused overnight gap when status_events are available, instead of the raw actual_end - actual_start span", () => {
    const jobs = [
      job({
        actual_start: "2026-08-10T09:00:00Z",
        actual_end: "2026-08-11T13:00:00Z", // ~28h wall-clock span
        status_events: [
          { to_status: "in_progress", occurred_at: "2026-08-10T09:00:00Z" },
          { to_status: "on_hold", occurred_at: "2026-08-10T17:00:00Z" }, // 8h
          { to_status: "in_progress", occurred_at: "2026-08-11T09:00:00Z" },
          { to_status: "submitted", occurred_at: "2026-08-11T13:00:00Z" }, // 4h
        ],
      }),
    ];
    expect(computeAverageTimeOnSiteMinutes(jobs)).toBe(12 * 60);
  });

  it("falls back to actual_end - actual_start when a job has no status_events to compute from", () => {
    const jobs = [job({ actual_start: "2026-08-10T09:00:00Z", actual_end: "2026-08-10T10:00:00Z" })];
    expect(computeAverageTimeOnSiteMinutes(jobs)).toBe(60);
  });
});

describe("computeRevisitRateByCause", () => {
  it("only counts issues that actually caused a revisit", () => {
    const issues = [
      issue({ category: "install", revisit_job_id: "r1" }),
      issue({ category: "install", revisit_job_id: null }), // didn't cause a revisit
    ];
    expect(computeRevisitRateByCause(issues)).toEqual([{ category: "install", count: 1, rate: 1 }]);
  });

  it("groups by category and computes each share of total revisits", () => {
    const issues = [
      issue({ category: "install", revisit_job_id: "r1" }),
      issue({ category: "install", revisit_job_id: "r2" }),
      issue({ category: "network", revisit_job_id: "r3" }),
    ];
    expect(computeRevisitRateByCause(issues)).toEqual([
      { category: "install", count: 2, rate: 2 / 3 },
      { category: "network", count: 1, rate: 1 / 3 },
    ]);
  });

  it("buckets a null category as 'uncategorised' instead of dropping it", () => {
    const issues = [issue({ category: null, revisit_job_id: "r1" })];
    expect(computeRevisitRateByCause(issues)).toEqual([{ category: "uncategorised", count: 1, rate: 1 }]);
  });

  it("returns an empty array rather than NaN rates when nothing caused a revisit", () => {
    expect(computeRevisitRateByCause([issue({ revisit_job_id: null })])).toEqual([]);
  });
});

describe("computeOpenIssuesByAge", () => {
  const now = "2026-08-10T00:00:00.000Z";

  it("buckets by age and ignores resolved issues", () => {
    const issues = [
      issue({ status: "open", created_at: "2026-08-08T00:00:00.000Z" }), // 2 days
      issue({ status: "open", created_at: "2026-08-01T00:00:00.000Z" }), // 9 days
      issue({ status: "resolved", created_at: "2026-07-01T00:00:00.000Z" }), // old but resolved
    ];
    expect(computeOpenIssuesByAge(issues, now)).toEqual([
      { label: "0–7 days", count: 1 },
      { label: "8–14 days", count: 1 },
      { label: "15–30 days", count: 0 },
      { label: "30+ days", count: 0 },
    ]);
  });

  it("puts a very old issue in the 30+ bucket", () => {
    const issues = [issue({ status: "open", created_at: "2026-01-01T00:00:00.000Z" })];
    const buckets = computeOpenIssuesByAge(issues, now);
    expect(buckets.find((b) => b.label === "30+ days")?.count).toBe(1);
  });

  it("excludes an issue whose job has since closed, even though the issue's own status is still 'open'", () => {
    // Nothing in this app ever moves an issue's own status column away from
    // "open" (see the function's own doc comment), so this is the only
    // signal that actually distinguishes a still-open problem from one
    // whose job was closed out — the exact case that was undercounting
    // "closed" and overcounting "open issues" on the real dashboard.
    const issues = [
      issue({ status: "open", created_at: "2026-08-08T00:00:00.000Z", job: { status: "closed" } }),
      issue({ status: "open", created_at: "2026-08-08T00:00:00.000Z", job: { status: "in_progress" } }),
    ];
    expect(computeOpenIssuesByAge(issues, now)).toEqual([
      { label: "0–7 days", count: 1 },
      { label: "8–14 days", count: 0 },
      { label: "15–30 days", count: 0 },
      { label: "30+ days", count: 0 },
    ]);
  });

  it("still counts an issue whose job is missing locally (job: null) — only a confirmed 'closed' excludes it", () => {
    const issues = [issue({ status: "open", created_at: "2026-08-08T00:00:00.000Z", job: null })];
    expect(computeOpenIssuesByAge(issues, now)).toEqual([
      { label: "0–7 days", count: 1 },
      { label: "8–14 days", count: 0 },
      { label: "15–30 days", count: 0 },
      { label: "30+ days", count: 0 },
    ]);
  });
});

describe("computeEngineerWorkload", () => {
  it("counts only active-status jobs per engineer, sorted busiest first", () => {
    const engineers = [
      { id: "e1", name: "Alice" },
      { id: "e2", name: "Bob" },
    ];
    const jobs = [
      job({ assigned_to: "e1", status: "in_progress" }),
      job({ assigned_to: "e1", status: "scheduled" }),
      job({ assigned_to: "e1", status: "closed" }), // not active, excluded
      job({ assigned_to: "e2", status: "on_site" }),
    ];
    expect(computeEngineerWorkload(jobs, engineers)).toEqual([
      { engineerId: "e1", engineerName: "Alice", activeCount: 2 },
      { engineerId: "e2", engineerName: "Bob", activeCount: 1 },
    ]);
  });

  it("includes an engineer with zero active jobs at zero rather than omitting them", () => {
    const engineers = [{ id: "e1", name: "Alice" }];
    expect(computeEngineerWorkload([], engineers)).toEqual([{ engineerId: "e1", engineerName: "Alice", activeCount: 0 }]);
  });
});
