import { describe, expect, it } from "vitest";
import { computeWorkedMinutes } from "./worked-duration";

describe("computeWorkedMinutes", () => {
  it("matches a plain actual_end - actual_start job with no pauses", () => {
    const minutes = computeWorkedMinutes([
      { to_status: "travelling", occurred_at: "2026-08-24T08:00:00Z" },
      { to_status: "in_progress", occurred_at: "2026-08-24T09:00:00Z" },
      { to_status: "submitted", occurred_at: "2026-08-24T11:30:00Z" },
    ]);
    expect(minutes).toBe(150); // 2h30m, same as a raw actual_end - actual_start subtraction
  });

  it("excludes the overnight gap for a job paused and resumed across two days", () => {
    const minutes = computeWorkedMinutes([
      { to_status: "in_progress", occurred_at: "2026-08-24T09:00:00Z" },
      { to_status: "on_hold", occurred_at: "2026-08-24T17:00:00Z" }, // 8h worked day 1
      { to_status: "in_progress", occurred_at: "2026-08-25T09:00:00Z" }, // overnight gap excluded
      { to_status: "submitted", occurred_at: "2026-08-25T13:00:00Z" }, // 4h worked day 2
    ]);
    expect(minutes).toBe(12 * 60); // 8h + 4h, not the ~28h wall-clock span
  });

  it("sums three or more separate sessions across a job paused multiple times", () => {
    const minutes = computeWorkedMinutes([
      { to_status: "in_progress", occurred_at: "2026-08-24T09:00:00Z" },
      { to_status: "on_hold", occurred_at: "2026-08-24T10:00:00Z" }, // 1h
      { to_status: "in_progress", occurred_at: "2026-08-25T09:00:00Z" },
      { to_status: "on_hold", occurred_at: "2026-08-25T11:00:00Z" }, // 2h
      { to_status: "in_progress", occurred_at: "2026-08-26T09:00:00Z" },
      { to_status: "submitted", occurred_at: "2026-08-26T12:00:00Z" }, // 3h
    ]);
    expect(minutes).toBe(6 * 60);
  });

  it("ignores events unrelated to in_progress (e.g. the travel leg)", () => {
    const minutes = computeWorkedMinutes([
      { to_status: "scheduled", occurred_at: "2026-08-24T07:00:00Z" },
      { to_status: "travelling", occurred_at: "2026-08-24T08:00:00Z" },
      { to_status: "on_site", occurred_at: "2026-08-24T08:50:00Z" },
      { to_status: "in_progress", occurred_at: "2026-08-24T09:00:00Z" },
      { to_status: "submitted", occurred_at: "2026-08-24T10:00:00Z" },
    ]);
    expect(minutes).toBe(60);
  });

  it("is order-independent — sorts events itself rather than trusting input order", () => {
    const minutes = computeWorkedMinutes([
      { to_status: "submitted", occurred_at: "2026-08-24T11:00:00Z" },
      { to_status: "in_progress", occurred_at: "2026-08-24T09:00:00Z" },
    ]);
    expect(minutes).toBe(120);
  });

  it("returns null when the job is still in_progress with no closing event yet", () => {
    const minutes = computeWorkedMinutes([{ to_status: "in_progress", occurred_at: "2026-08-24T09:00:00Z" }]);
    expect(minutes).toBeNull();
  });

  it("returns null for an empty history", () => {
    expect(computeWorkedMinutes([])).toBeNull();
  });
});
