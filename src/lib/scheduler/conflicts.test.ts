import { describe, expect, it } from "vitest";
import { detectConflicts } from "./conflicts";

const job = (id: string, start: string, end: string) => ({ id, scheduledStart: start, scheduledEnd: end });

describe("detectConflicts", () => {
  it("returns no warnings when the day is clear and under the daily max", () => {
    const warnings = detectConflicts(
      job("moving", "2026-08-05T09:00:00Z", "2026-08-05T11:00:00Z"),
      [],
      4,
    );
    expect(warnings).toHaveLength(0);
  });

  it("flags a time overlap with an existing job", () => {
    const warnings = detectConflicts(
      job("moving", "2026-08-05T09:00:00Z", "2026-08-05T11:00:00Z"),
      [job("existing", "2026-08-05T10:00:00Z", "2026-08-05T12:00:00Z")],
      4,
    );
    expect(warnings.some((w) => w.includes("Overlaps"))).toBe(true);
  });

  it("does not flag back-to-back jobs that only touch at the boundary", () => {
    const warnings = detectConflicts(
      job("moving", "2026-08-05T09:00:00Z", "2026-08-05T11:00:00Z"),
      [job("existing", "2026-08-05T11:00:00Z", "2026-08-05T13:00:00Z")],
      4,
    );
    expect(warnings.some((w) => w.includes("Overlaps"))).toBe(false);
  });

  it("flags exceeding the engineer's daily max even with no time overlap", () => {
    const others = [
      job("a", "2026-08-05T06:00:00Z", "2026-08-05T07:00:00Z"),
      job("b", "2026-08-05T08:00:00Z", "2026-08-05T09:00:00Z"),
      job("c", "2026-08-05T14:00:00Z", "2026-08-05T15:00:00Z"),
    ];
    const warnings = detectConflicts(job("moving", "2026-08-05T20:00:00Z", "2026-08-05T21:00:00Z"), others, 3);
    expect(warnings.some((w) => w.includes("exceeds") || w.includes("exceeding"))).toBe(true);
  });

  it("defaults a missing end time to a 2-hour duration for overlap checks", () => {
    const warnings = detectConflicts(
      job("moving", "2026-08-05T09:00:00Z", "2026-08-05T11:00:00Z"),
      [{ id: "existing", scheduledStart: "2026-08-05T10:30:00Z", scheduledEnd: null }],
      4,
    );
    expect(warnings.some((w) => w.includes("Overlaps"))).toBe(true);
  });

  it("flags when the day's total scheduled duration reaches 8 hours, even with no overlap and under the job-count max", () => {
    const others = [
      job("a", "2026-08-05T06:00:00Z", "2026-08-05T10:00:00Z"), // 4h
    ];
    const warnings = detectConflicts(job("moving", "2026-08-05T11:00:00Z", "2026-08-05T15:00:00Z"), others, 10); // +4h = 8h
    expect(warnings.some((w) => w.includes("8h working day"))).toBe(true);
  });

  it("does not flag a day under 8 hours scheduled", () => {
    const others = [job("a", "2026-08-05T06:00:00Z", "2026-08-05T09:00:00Z")]; // 3h
    const warnings = detectConflicts(job("moving", "2026-08-05T10:00:00Z", "2026-08-05T13:00:00Z"), others, 10); // +3h = 6h
    expect(warnings.some((w) => w.includes("working day"))).toBe(false);
  });

  it("never blocks — still returns the warning rather than an error or empty result — for a day well past 8 hours", () => {
    const others = [job("a", "2026-08-05T06:00:00Z", "2026-08-05T12:00:00Z")]; // 6h
    const warnings = detectConflicts(job("moving", "2026-08-05T13:00:00Z", "2026-08-05T18:00:00Z"), others, 10); // +5h = 11h
    expect(warnings).toEqual(["11h scheduled that day exceeds the 8h working day."]);
  });
});
