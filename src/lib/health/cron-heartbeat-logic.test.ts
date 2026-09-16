import { describe, expect, it } from "vitest";
import { CRON_EXPECTATIONS, evaluateCronHeartbeat, type CronHeartbeatRow } from "./cron-heartbeat-logic";

const NOW = "2026-09-16T12:00:00.000Z";
const driveMediaSync = CRON_EXPECTATIONS.find((c) => c.name === "drive-media-sync")!;
const dayBeforeReminders = CRON_EXPECTATIONS.find((c) => c.name === "day-before-reminders")!;

describe("evaluateCronHeartbeat", () => {
  it("treats a cron that has never recorded a heartbeat as healthy, not failing", () => {
    const result = evaluateCronHeartbeat(driveMediaSync, undefined, NOW);
    expect(result).toEqual({ key: "cron:drive-media-sync", ok: true, detail: "no heartbeat recorded yet" });
  });

  it("is healthy when the last run was recent and succeeded", () => {
    const row: CronHeartbeatRow = { last_run_at: "2026-09-16T11:50:00.000Z", last_ok: true, last_detail: "sent: 3" };
    const result = evaluateCronHeartbeat(driveMediaSync, row, NOW);
    expect(result.ok).toBe(true);
  });

  it("flags stale once a run is older than the cron's expected cadence", () => {
    // drive-media-sync expects every 15 min with slack up to 45 min — 46 min old is past it.
    const row: CronHeartbeatRow = { last_run_at: "2026-09-16T11:14:00.000Z", last_ok: true, last_detail: "sent: 3" };
    const result = evaluateCronHeartbeat(driveMediaSync, row, NOW);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("expected within");
  });

  it("does not flag a daily cron as stale just because it's been several hours", () => {
    // day-before-reminders allows up to 26h — 20h old is well within that.
    const row: CronHeartbeatRow = { last_run_at: "2026-09-15T16:00:00.000Z", last_ok: true, last_detail: "sent: 2" };
    const result = evaluateCronHeartbeat(dayBeforeReminders, row, NOW);
    expect(result.ok).toBe(true);
  });

  it("flags a cron whose most recent run itself failed, even if it's recent", () => {
    const row: CronHeartbeatRow = { last_run_at: "2026-09-16T11:59:00.000Z", last_ok: false, last_detail: "boom" };
    const result = evaluateCronHeartbeat(driveMediaSync, row, NOW);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("boom");
  });
});
