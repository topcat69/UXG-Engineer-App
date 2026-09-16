import { describe, expect, it } from "vitest";
import { formatRelativeTime, groupHealthChecks, summarizeHealthChecks, type HealthCheckRow } from "./health-checks-view";

function row(key: string, is_healthy: boolean, overrides: Partial<HealthCheckRow> = {}): HealthCheckRow {
  return {
    key,
    is_healthy,
    last_detail: null,
    last_ok_at: null,
    last_fail_at: null,
    last_notified_at: null,
    updated_at: "2026-09-16T15:00:00.000Z",
    ...overrides,
  };
}

describe("groupHealthChecks", () => {
  it("groups by key prefix and labels integrations by their real product name", () => {
    const rows = [
      row("integration:monday", true),
      row("schema", true),
      row("db", true),
      row("cron:drive-media-sync", true),
      row("integration:drive", true),
    ];
    const groups = groupHealthChecks(rows);
    expect(groups.core.map((r) => r.key)).toEqual(["db", "schema"]); // fixed order, not alphabetical
    expect(groups.crons.map((r) => r.label)).toEqual(["drive-media-sync"]);
    expect(groups.integrations.map((r) => r.label).sort()).toEqual(["Google Drive", "Monday.com"]);
  });

  it("puts unhealthy checks first within a group", () => {
    const rows = [row("cron:weekly-summary", true), row("cron:day-before-reminders", false)];
    const groups = groupHealthChecks(rows);
    expect(groups.crons[0].key).toBe("cron:day-before-reminders");
    expect(groups.crons[0].is_healthy).toBe(false);
  });

  it("falls back to a humanized label and the 'other' group for an unrecognized key shape", () => {
    const groups = groupHealthChecks([row("something-new", true)]);
    expect(groups.other).toHaveLength(1);
    expect(groups.core).toHaveLength(0);
  });

  it("returns empty groups for no rows, rather than throwing", () => {
    const groups = groupHealthChecks([]);
    expect(groups).toEqual({ core: [], crons: [], integrations: [], other: [] });
  });
});

describe("summarizeHealthChecks", () => {
  it("counts healthy and unhealthy separately", () => {
    const rows = [row("db", true), row("schema", true), row("integration:monday", false)];
    expect(summarizeHealthChecks(rows)).toEqual({ healthy: 2, unhealthy: 1 });
  });
});

describe("formatRelativeTime", () => {
  const now = "2026-09-16T15:00:00.000Z";

  it("returns an em dash for a null timestamp", () => {
    expect(formatRelativeTime(null, now)).toBe("—");
  });

  it("reads as 'just now' for anything under a minute old", () => {
    expect(formatRelativeTime("2026-09-16T14:59:30.000Z", now)).toBe("just now");
  });

  it("shows minutes for under an hour", () => {
    expect(formatRelativeTime("2026-09-16T14:45:00.000Z", now)).toBe("15 min ago");
  });

  it("shows hours for under a day", () => {
    expect(formatRelativeTime("2026-09-16T09:00:00.000Z", now)).toBe("6h ago");
  });

  it("shows days beyond that", () => {
    expect(formatRelativeTime("2026-09-14T15:00:00.000Z", now)).toBe("2d ago");
  });
});
