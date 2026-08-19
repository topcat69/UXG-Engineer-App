import { describe, expect, it } from "vitest";
import { isInEngineerQueue } from "./engineer-queue";

describe("isInEngineerQueue", () => {
  it("keeps pre-submission and in-progress statuses in the queue", () => {
    expect(isInEngineerQueue("draft")).toBe(true);
    expect(isInEngineerQueue("scheduled")).toBe(true);
    expect(isInEngineerQueue("dispatched")).toBe(true);
    expect(isInEngineerQueue("accepted")).toBe(true);
    expect(isInEngineerQueue("travelling")).toBe(true);
    expect(isInEngineerQueue("on_site")).toBe(true);
    expect(isInEngineerQueue("in_progress")).toBe(true);
    expect(isInEngineerQueue("on_hold")).toBe(true);
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
});
