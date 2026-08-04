import { describe, expect, it } from "vitest";
import { jobIdsSafeToOverwrite } from "./sync-down";

describe("jobIdsSafeToOverwrite", () => {
  it("returns all fetched ids when nothing is pending", () => {
    expect(jobIdsSafeToOverwrite(["a", "b"], new Set())).toEqual(["a", "b"]);
  });

  it("excludes jobs with a pending outbox operation", () => {
    expect(jobIdsSafeToOverwrite(["a", "b", "c"], new Set(["b"]))).toEqual(["a", "c"]);
  });

  it("returns an empty list when everything is pending", () => {
    expect(jobIdsSafeToOverwrite(["a", "b"], new Set(["a", "b"]))).toEqual([]);
  });
});
