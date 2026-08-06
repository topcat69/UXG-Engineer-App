import { describe, expect, it } from "vitest";
import { cloneTasksForJob } from "./clone-tasks";

describe("cloneTasksForJob", () => {
  it("re-indexes positions from 0 in source order", () => {
    const result = cloneTasksForJob(
      [
        { position: 5, label: "Second" },
        { position: 1, label: "First" },
      ],
      "job-1",
    );
    expect(result).toEqual([
      { job_id: "job-1", position: 0, label: "First", is_done: false },
      { job_id: "job-1", position: 1, label: "Second", is_done: false },
    ]);
  });

  it("always resets is_done, regardless of any done state on the source", () => {
    const result = cloneTasksForJob([{ position: 0, label: "Check panel" }], "job-2");
    expect(result[0].is_done).toBe(false);
  });

  it("returns an empty array for an empty source", () => {
    expect(cloneTasksForJob([], "job-3")).toEqual([]);
  });
});
