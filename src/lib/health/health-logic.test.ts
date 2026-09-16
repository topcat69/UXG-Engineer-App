import { describe, expect, it } from "vitest";
import { decideHealthCheckTransition, REMINDER_COOLDOWN_MS, type PreviousHealthRow } from "./health-logic";

const NOW = "2026-09-16T12:00:00.000Z";

describe("decideHealthCheckTransition", () => {
  it("does not notify when a check stays healthy", () => {
    const previous: PreviousHealthRow = { is_healthy: true, last_ok_at: "2026-09-16T11:00:00.000Z", last_fail_at: null, last_notified_at: null };
    const { notify, row } = decideHealthCheckTransition({ key: "db", ok: true, detail: "reachable" }, previous, NOW);
    expect(notify).toBeNull();
    expect(row.is_healthy).toBe(true);
    expect(row.last_ok_at).toBe(NOW);
    expect(row.last_notified_at).toBeNull();
  });

  it("notifies once when a check has never run before and is already failing", () => {
    const { notify, row } = decideHealthCheckTransition({ key: "db", ok: false, detail: "connection refused" }, undefined, NOW);
    expect(notify).toEqual({ key: "db", kind: "new_failure", detail: "connection refused" });
    expect(row.is_healthy).toBe(false);
    expect(row.last_fail_at).toBe(NOW);
    expect(row.last_notified_at).toBe(NOW);
  });

  it("notifies once on the healthy -> bad edge, not on every subsequent bad run", () => {
    const healthy: PreviousHealthRow = { is_healthy: true, last_ok_at: "2026-09-16T11:00:00.000Z", last_fail_at: null, last_notified_at: null };
    const first = decideHealthCheckTransition({ key: "schema", ok: false, detail: "missing column" }, healthy, NOW);
    expect(first.notify).toEqual({ key: "schema", kind: "new_failure", detail: "missing column" });

    // Same failure, 5 minutes later — well within the cooldown, so no repeat email.
    const stillBadSoon = decideHealthCheckTransition(
      { key: "schema", ok: false, detail: "missing column" },
      first.row,
      "2026-09-16T12:05:00.000Z",
    );
    expect(stillBadSoon.notify).toBeNull();
  });

  it("sends a reminder once the cooldown has elapsed while still bad", () => {
    const stillBadAndNotifiedRecently: PreviousHealthRow = {
      is_healthy: false,
      last_ok_at: null,
      last_fail_at: "2026-09-16T08:00:00.000Z",
      last_notified_at: "2026-09-16T08:00:00.000Z",
    };
    const justUnderCooldown = decideHealthCheckTransition(
      { key: "cron:drive-media-sync", ok: false, detail: "no heartbeat" },
      stillBadAndNotifiedRecently,
      new Date(new Date(stillBadAndNotifiedRecently.last_notified_at!).getTime() + REMINDER_COOLDOWN_MS - 1000).toISOString(),
    );
    expect(justUnderCooldown.notify).toBeNull();

    const pastCooldown = decideHealthCheckTransition(
      { key: "cron:drive-media-sync", ok: false, detail: "no heartbeat" },
      stillBadAndNotifiedRecently,
      new Date(new Date(stillBadAndNotifiedRecently.last_notified_at!).getTime() + REMINDER_COOLDOWN_MS + 1000).toISOString(),
    );
    expect(pastCooldown.notify).toEqual({ key: "cron:drive-media-sync", kind: "still_failing", detail: "no heartbeat" });
  });

  it("notifies once on the bad -> healthy edge (recovery)", () => {
    const bad: PreviousHealthRow = { is_healthy: false, last_ok_at: null, last_fail_at: "2026-09-16T10:00:00.000Z", last_notified_at: "2026-09-16T10:00:00.000Z" };
    const { notify, row } = decideHealthCheckTransition({ key: "db", ok: true, detail: "reachable" }, bad, NOW);
    expect(notify).toEqual({ key: "db", kind: "recovered", detail: "reachable" });
    expect(row.is_healthy).toBe(true);
    expect(row.last_fail_at).toBe(bad.last_fail_at); // preserved, not cleared — a history of when it last failed
  });

  it("preserves the other timestamp across an update rather than clearing it", () => {
    const bad: PreviousHealthRow = { is_healthy: false, last_ok_at: "2026-09-15T09:00:00.000Z", last_fail_at: "2026-09-16T10:00:00.000Z", last_notified_at: null };
    const { row } = decideHealthCheckTransition({ key: "db", ok: false, detail: "still down" }, bad, NOW);
    expect(row.last_ok_at).toBe(bad.last_ok_at);
    expect(row.last_fail_at).toBe(NOW);
  });
});
