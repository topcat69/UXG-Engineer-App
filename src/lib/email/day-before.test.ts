import { describe, expect, it } from "vitest";
import { isScheduledForTomorrow } from "./day-before";

describe("isScheduledForTomorrow", () => {
  it("is true when the job's UTC calendar day is exactly one day after now", () => {
    expect(isScheduledForTomorrow("2026-08-11T09:00:00.000Z", "2026-08-10T14:00:00.000Z")).toBe(true);
  });

  it("is false for today", () => {
    expect(isScheduledForTomorrow("2026-08-10T09:00:00.000Z", "2026-08-10T14:00:00.000Z")).toBe(false);
  });

  it("is false for two days from now", () => {
    expect(isScheduledForTomorrow("2026-08-12T09:00:00.000Z", "2026-08-10T14:00:00.000Z")).toBe(false);
  });

  it("is false for yesterday", () => {
    expect(isScheduledForTomorrow("2026-08-09T09:00:00.000Z", "2026-08-10T14:00:00.000Z")).toBe(false);
  });

  it("handles a month boundary correctly", () => {
    expect(isScheduledForTomorrow("2026-09-01T09:00:00.000Z", "2026-08-31T23:30:00.000Z")).toBe(true);
  });

  it("is time-of-day independent within the target day", () => {
    expect(isScheduledForTomorrow("2026-08-11T23:59:00.000Z", "2026-08-10T00:01:00.000Z")).toBe(true);
    expect(isScheduledForTomorrow("2026-08-11T00:00:01.000Z", "2026-08-10T00:01:00.000Z")).toBe(true);
  });
});
