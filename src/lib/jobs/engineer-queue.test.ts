import { describe, expect, it } from "vitest";
import { isInEngineerQueue } from "./engineer-queue";

describe("isInEngineerQueue", () => {
  it("keeps scheduled and in-progress statuses in the queue", () => {
    expect(isInEngineerQueue("scheduled")).toBe(true);
    expect(isInEngineerQueue("dispatched")).toBe(true);
    expect(isInEngineerQueue("accepted")).toBe(true);
    expect(isInEngineerQueue("travelling")).toBe(true);
    expect(isInEngineerQueue("on_site")).toBe(true);
    expect(isInEngineerQueue("in_progress")).toBe(true);
    expect(isInEngineerQueue("on_hold")).toBe(true);
  });

  it("drops draft jobs — assigned isn't the same as scheduled yet", () => {
    expect(isInEngineerQueue("draft")).toBe(false);
  });

  it("drops a job once it's been checked out (submitted onward)", () => {
    expect(isInEngineerQueue("submitted")).toBe(false);
    expect(isInEngineerQueue("under_review")).toBe(false);
    expect(isInEngineerQueue("approved")).toBe(false);
    expect(isInEngineerQueue("closed")).toBe(false);
  });

  it("drops cancelled jobs", () => {
    expect(isInEngineerQueue("cancelled")).toBe(false);
  });

  it("drops a job QA has rejected into a revisit — the redo happens on the new linked job instead", () => {
    expect(isInEngineerQueue("revisit")).toBe(false);
  });
});
