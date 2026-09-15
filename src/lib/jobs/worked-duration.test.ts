import { describe, expect, it } from "vitest";
import {
  computeDailyMinutes,
  computeEngineerDayMinutes,
  computeTimesheetMinutes,
  computeTravelMinutes,
  computeWorkedMinutes,
  roundToNearest15Minutes,
} from "./worked-duration";

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

describe("computeTravelMinutes", () => {
  it("sums the travelling -> in_progress span, ignoring on-site work", () => {
    const minutes = computeTravelMinutes([
      { to_status: "travelling", occurred_at: "2026-08-24T08:00:00Z" },
      { to_status: "in_progress", occurred_at: "2026-08-24T08:45:00Z" },
      { to_status: "submitted", occurred_at: "2026-08-24T11:00:00Z" },
    ]);
    expect(minutes).toBe(45);
  });

  it("returns null when travel never started", () => {
    expect(
      computeTravelMinutes([
        { to_status: "in_progress", occurred_at: "2026-08-24T09:00:00Z" },
        { to_status: "submitted", occurred_at: "2026-08-24T10:00:00Z" },
      ]),
    ).toBeNull();
  });
});

describe("roundToNearest15Minutes", () => {
  it("rounds to the nearest 15-minute mark", () => {
    expect(roundToNearest15Minutes(0)).toBe(0);
    expect(roundToNearest15Minutes(7)).toBe(0);
    expect(roundToNearest15Minutes(8)).toBe(15);
    expect(roundToNearest15Minutes(37)).toBe(30);
    expect(roundToNearest15Minutes(38)).toBe(45);
    expect(roundToNearest15Minutes(60)).toBe(60);
  });
});

describe("computeTimesheetMinutes", () => {
  it("rounds travel, work, and total independently rather than summing rounded figures", () => {
    // Travel = 22min (rounds to 15), work = 22min (rounds to 15) — but the
    // raw total of 44min rounds to 45, not 30 (15 + 15). Independent
    // rounding of the true total is exactly the confirmed behaviour.
    const result = computeTimesheetMinutes([
      { to_status: "travelling", occurred_at: "2026-08-24T08:00:00Z" },
      { to_status: "in_progress", occurred_at: "2026-08-24T08:22:00Z" },
      { to_status: "submitted", occurred_at: "2026-08-24T08:44:00Z" },
    ]);
    expect(result.travelMinutes).toBe(15);
    expect(result.workMinutes).toBe(15);
    expect(result.totalMinutes).toBe(45);
  });

  it("returns null across the board for a job with no travel or work history", () => {
    expect(computeTimesheetMinutes([{ to_status: "draft", occurred_at: "2026-08-24T08:00:00Z" }])).toEqual({
      travelMinutes: null,
      workMinutes: null,
      totalMinutes: null,
    });
  });

  it("treats a missing figure as zero for the total when only one of travel/work is present", () => {
    const result = computeTimesheetMinutes([
      { to_status: "travelling", occurred_at: "2026-08-24T08:00:00Z" },
      { to_status: "cancelled", occurred_at: "2026-08-24T08:30:00Z" },
    ]);
    expect(result.travelMinutes).toBe(30);
    expect(result.workMinutes).toBeNull();
    expect(result.totalMinutes).toBe(30);
  });
});

describe("computeDailyMinutes", () => {
  it("attributes a same-day job entirely to that one day", () => {
    const daily = computeDailyMinutes([
      { to_status: "travelling", occurred_at: "2026-08-24T08:00:00Z" },
      { to_status: "in_progress", occurred_at: "2026-08-24T08:45:00Z" },
      { to_status: "submitted", occurred_at: "2026-08-24T11:00:00Z" },
    ]);
    expect(daily.size).toBe(1);
    expect(daily.get("2026-08-24")).toEqual({ travelMinutes: 45, workMinutes: 135 });
  });

  it("splits a shift that runs past UTC midnight across both days", () => {
    const daily = computeDailyMinutes([
      { to_status: "in_progress", occurred_at: "2026-08-24T23:00:00Z" },
      { to_status: "submitted", occurred_at: "2026-08-25T01:30:00Z" },
    ]);
    expect(daily.get("2026-08-24")).toEqual({ travelMinutes: 0, workMinutes: 60 });
    expect(daily.get("2026-08-25")).toEqual({ travelMinutes: 0, workMinutes: 90 });
  });

  it("gives each day worked its own contribution for a job paused overnight across three days", () => {
    const daily = computeDailyMinutes([
      { to_status: "in_progress", occurred_at: "2026-08-24T09:00:00Z" },
      { to_status: "on_hold", occurred_at: "2026-08-24T17:00:00Z" }, // 8h day 1
      { to_status: "in_progress", occurred_at: "2026-08-25T09:00:00Z" },
      { to_status: "on_hold", occurred_at: "2026-08-25T11:00:00Z" }, // 2h day 2
      { to_status: "in_progress", occurred_at: "2026-08-26T09:00:00Z" },
      { to_status: "submitted", occurred_at: "2026-08-26T12:00:00Z" }, // 3h day 3
    ]);
    expect(daily.get("2026-08-24")?.workMinutes).toBe(8 * 60);
    expect(daily.get("2026-08-25")?.workMinutes).toBe(2 * 60);
    expect(daily.get("2026-08-26")?.workMinutes).toBe(3 * 60);
  });

  it("returns an empty map for a job with no travel or work history", () => {
    expect(computeDailyMinutes([{ to_status: "draft", occurred_at: "2026-08-24T08:00:00Z" }]).size).toBe(0);
  });
});

describe("computeEngineerDayMinutes", () => {
  it("sums raw minutes across jobs on the same engineer/day before rounding once", () => {
    // Two jobs each contribute 22 raw minutes of work on the same day —
    // rounded separately that's 15 + 15 = 30, but summed raw first (44
    // minutes) and rounded once it's 45. Confirms the aggregation avoids
    // compounding each job's independent per-job rounding error.
    const result = computeEngineerDayMinutes([
      {
        assignedTo: "eng-1",
        events: [
          { to_status: "in_progress", occurred_at: "2026-08-24T09:00:00Z" },
          { to_status: "submitted", occurred_at: "2026-08-24T09:22:00Z" },
        ],
      },
      {
        assignedTo: "eng-1",
        events: [
          { to_status: "in_progress", occurred_at: "2026-08-24T13:00:00Z" },
          { to_status: "submitted", occurred_at: "2026-08-24T13:22:00Z" },
        ],
      },
    ]);
    expect(result.get("eng-1")?.get("2026-08-24")).toEqual({ travelMinutes: 0, workMinutes: 45, totalMinutes: 45 });
  });

  it("keeps engineers separate and skips jobs with no assignee", () => {
    const result = computeEngineerDayMinutes([
      {
        assignedTo: "eng-1",
        events: [
          { to_status: "in_progress", occurred_at: "2026-08-24T09:00:00Z" },
          { to_status: "submitted", occurred_at: "2026-08-24T10:00:00Z" },
        ],
      },
      {
        assignedTo: "eng-2",
        events: [
          { to_status: "in_progress", occurred_at: "2026-08-24T09:00:00Z" },
          { to_status: "submitted", occurred_at: "2026-08-24T09:30:00Z" },
        ],
      },
      {
        assignedTo: null,
        events: [
          { to_status: "in_progress", occurred_at: "2026-08-24T09:00:00Z" },
          { to_status: "submitted", occurred_at: "2026-08-24T12:00:00Z" },
        ],
      },
    ]);
    expect(result.get("eng-1")?.get("2026-08-24")?.workMinutes).toBe(60);
    expect(result.get("eng-2")?.get("2026-08-24")?.workMinutes).toBe(30);
    expect(result.size).toBe(2);
  });
});
