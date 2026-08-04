import { describe, expect, it } from "vitest";
import { countWeekJobs } from "./weekly-summary";

describe("countWeekJobs", () => {
  it("counts closed/approved as completed", () => {
    expect(countWeekJobs(["closed", "approved"])).toEqual({ completedCount: 2, scheduledCount: 0 });
  });

  it("counts everything still in flight as scheduled", () => {
    expect(countWeekJobs(["scheduled", "dispatched", "in_progress", "submitted", "under_review"])).toEqual({
      completedCount: 0,
      scheduledCount: 5,
    });
  });

  it("excludes draft, cancelled, and on_hold from both counts", () => {
    expect(countWeekJobs(["draft", "cancelled", "on_hold"])).toEqual({ completedCount: 0, scheduledCount: 0 });
  });

  it("handles a mixed week", () => {
    expect(countWeekJobs(["closed", "closed", "scheduled", "draft"])).toEqual({
      completedCount: 2,
      scheduledCount: 1,
    });
  });

  it("returns zero counts for an empty week", () => {
    expect(countWeekJobs([])).toEqual({ completedCount: 0, scheduledCount: 0 });
  });
});
