import { describe, expect, it } from "vitest";
import { statusColorBucket, STATUS_COLOR_CLASSES, STATUS_SWATCH_CLASSES, type StatusColorBucket } from "./status-colors";

describe("statusColorBucket", () => {
  it("buckets pre-travel statuses as upcoming", () => {
    expect(statusColorBucket("scheduled")).toBe("upcoming");
    expect(statusColorBucket("dispatched")).toBe("upcoming");
    expect(statusColorBucket("accepted")).toBe("upcoming");
  });

  it("buckets travelling/on_site/in_progress as active", () => {
    expect(statusColorBucket("travelling")).toBe("active");
    expect(statusColorBucket("on_site")).toBe("active");
    expect(statusColorBucket("in_progress")).toBe("active");
  });

  it("buckets submitted/under_review as review", () => {
    expect(statusColorBucket("submitted")).toBe("review");
    expect(statusColorBucket("under_review")).toBe("review");
  });

  it("buckets approved/closed as done", () => {
    expect(statusColorBucket("approved")).toBe("done");
    expect(statusColorBucket("closed")).toBe("done");
  });

  it("buckets on_hold and cancelled distinctly", () => {
    expect(statusColorBucket("on_hold")).toBe("hold");
    expect(statusColorBucket("cancelled")).toBe("cancelled");
  });

  it("buckets draft as its own category", () => {
    expect(statusColorBucket("draft")).toBe("draft");
  });

  it("falls back to upcoming for an unrecognised status", () => {
    expect(statusColorBucket("something_new")).toBe("upcoming");
  });

  it("has a color class and a swatch class defined for every bucket", () => {
    const buckets: StatusColorBucket[] = ["draft", "upcoming", "active", "review", "done", "hold", "cancelled"];
    for (const bucket of buckets) {
      expect(STATUS_COLOR_CLASSES[bucket]).toBeTruthy();
      expect(STATUS_SWATCH_CLASSES[bucket]).toBeTruthy();
    }
  });
});
