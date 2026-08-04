import { describe, expect, it } from "vitest";
import { selectLifecycleEligibleJobIds } from "./media-lifecycle";

const now = "2026-08-04T00:00:00.000Z";
const oldEnough = "2026-05-01T00:00:00.000Z"; // > 90 days before `now`
const tooRecent = "2026-08-01T00:00:00.000Z"; // < 90 days before `now`

describe("selectLifecycleEligibleJobIds", () => {
  it("selects a draft job untouched past the retention window", () => {
    const ids = selectLifecycleEligibleJobIds([{ id: "a", status: "draft", updated_at: oldEnough }], now);
    expect(ids).toEqual(["a"]);
  });

  it("selects a cancelled job untouched past the retention window", () => {
    const ids = selectLifecycleEligibleJobIds([{ id: "a", status: "cancelled", updated_at: oldEnough }], now);
    expect(ids).toEqual(["a"]);
  });

  it("excludes a draft job updated too recently", () => {
    const ids = selectLifecycleEligibleJobIds([{ id: "a", status: "draft", updated_at: tooRecent }], now);
    expect(ids).toEqual([]);
  });

  it("excludes a non-draft, non-cancelled job regardless of age", () => {
    const ids = selectLifecycleEligibleJobIds([{ id: "a", status: "closed", updated_at: oldEnough }], now);
    expect(ids).toEqual([]);
  });

  it("excludes a job with no updated_at rather than treating it as eligible", () => {
    const ids = selectLifecycleEligibleJobIds([{ id: "a", status: "draft", updated_at: null }], now);
    expect(ids).toEqual([]);
  });

  it("respects a custom retention window", () => {
    const ids = selectLifecycleEligibleJobIds([{ id: "a", status: "draft", updated_at: tooRecent }], now, 1);
    expect(ids).toEqual(["a"]);
  });
});
