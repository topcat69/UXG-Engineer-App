import { describe, expect, it } from "vitest";
import { classifySlaJob } from "./sla-compliance";

const NOW = new Date("2026-09-21T12:00:00Z");

describe("classifySlaJob", () => {
  it("is open when the job hasn't started yet", () => {
    expect(classifySlaJob({ actualStart: null, submittedAt: null, targetHours: 4 }, NOW)).toEqual({
      outcome: "open",
      durationHours: null,
    });
  });

  it("is open (with elapsed-so-far) when started but not yet submitted", () => {
    const result = classifySlaJob(
      { actualStart: "2026-09-21T10:00:00Z", submittedAt: null, targetHours: 4 },
      NOW,
    );
    expect(result.outcome).toBe("open");
    expect(result.durationHours).toBeCloseTo(2, 5);
  });

  it("is open when submitted but the client has no SLA target set", () => {
    const result = classifySlaJob(
      { actualStart: "2026-09-21T08:00:00Z", submittedAt: "2026-09-21T09:00:00Z", targetHours: null },
      NOW,
    );
    expect(result.outcome).toBe("open");
    expect(result.durationHours).toBeCloseTo(1, 5);
  });

  it("is met when the elapsed time is within target", () => {
    const result = classifySlaJob(
      { actualStart: "2026-09-21T08:00:00Z", submittedAt: "2026-09-21T10:00:00Z", targetHours: 4 },
      NOW,
    );
    expect(result).toEqual({ outcome: "met", durationHours: 2 });
  });

  it("is met exactly at the target boundary", () => {
    const result = classifySlaJob(
      { actualStart: "2026-09-21T08:00:00Z", submittedAt: "2026-09-21T12:00:00Z", targetHours: 4 },
      NOW,
    );
    expect(result).toEqual({ outcome: "met", durationHours: 4 });
  });

  it("is breached when the elapsed time exceeds target", () => {
    const result = classifySlaJob(
      { actualStart: "2026-09-21T08:00:00Z", submittedAt: "2026-09-21T13:00:00Z", targetHours: 4 },
      NOW,
    );
    expect(result).toEqual({ outcome: "breached", durationHours: 5 });
  });

  it("counts paused time against the clock — no gap is excluded", () => {
    // A job that sat on_hold for hours still measures wall-clock elapsed
    // time here, unlike worked-duration.ts's pause-aware computation —
    // per the blueprint's "pauses count against the clock by default".
    const result = classifySlaJob(
      { actualStart: "2026-09-21T00:00:00Z", submittedAt: "2026-09-21T10:00:00Z", targetHours: 4 },
      NOW,
    );
    expect(result).toEqual({ outcome: "breached", durationHours: 10 });
  });
});
