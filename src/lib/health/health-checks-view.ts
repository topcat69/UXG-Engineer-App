import { humanize } from "@/lib/format/text";

export type HealthCheckRow = {
  key: string;
  is_healthy: boolean;
  last_detail: string | null;
  last_ok_at: string | null;
  last_fail_at: string | null;
  last_notified_at: string | null;
  updated_at: string;
};

export type HealthCheckItem = HealthCheckRow & { label: string };

export type HealthCheckGroups = {
  core: HealthCheckItem[];
  crons: HealthCheckItem[];
  integrations: HealthCheckItem[];
  /** Anything that doesn't match a known key shape — a future check type this page hasn't been taught about yet, shown rather than silently dropped. */
  other: HealthCheckItem[];
};

/** Friendlier than the raw key (which is what recordIntegrationFailure/isXConfigured actually key by) — see checks.ts's INTEGRATIONS list for the source of truth on these four names. */
const INTEGRATION_LABELS: Record<string, string> = {
  drive: "Google Drive",
  calendar: "Google Calendar",
  resend: "Resend",
  monday: "Monday.com",
};

const CORE_ORDER = ["db", "schema"];

function labelFor(key: string): string {
  if (key === "db") return "Database";
  if (key === "schema") return "Schema";
  if (key.startsWith("cron:")) return key.slice("cron:".length);
  if (key.startsWith("integration:")) {
    const name = key.slice("integration:".length);
    return INTEGRATION_LABELS[name] ?? humanize(name);
  }
  return key;
}

/** Unhealthy first within a group — what needs attention should read at a glance, not require scanning the whole list. */
function byUrgencyThenLabel(a: HealthCheckItem, b: HealthCheckItem): number {
  if (a.is_healthy !== b.is_healthy) return a.is_healthy ? 1 : -1;
  return a.label.localeCompare(b.label);
}

/**
 * Watchdog Phase 4: pure grouping/labeling for the status page, split out
 * from the page itself so it's unit-testable without a live database —
 * same reasoning as the pure decision functions in Phases 1-3.
 */
export function groupHealthChecks(rows: HealthCheckRow[]): HealthCheckGroups {
  const groups: HealthCheckGroups = { core: [], crons: [], integrations: [], other: [] };
  for (const row of rows) {
    const item: HealthCheckItem = { ...row, label: labelFor(row.key) };
    if (row.key === "db" || row.key === "schema") groups.core.push(item);
    else if (row.key.startsWith("cron:")) groups.crons.push(item);
    else if (row.key.startsWith("integration:")) groups.integrations.push(item);
    else groups.other.push(item);
  }
  groups.core.sort((a, b) => CORE_ORDER.indexOf(a.key) - CORE_ORDER.indexOf(b.key));
  groups.crons.sort(byUrgencyThenLabel);
  groups.integrations.sort(byUrgencyThenLabel);
  groups.other.sort(byUrgencyThenLabel);
  return groups;
}

export function summarizeHealthChecks(rows: HealthCheckRow[]): { healthy: number; unhealthy: number } {
  let healthy = 0;
  let unhealthy = 0;
  for (const row of rows) {
    if (row.is_healthy) healthy++;
    else unhealthy++;
  }
  return { healthy, unhealthy };
}

/** `now` is passed in rather than read internally so this stays deterministic and testable — same reasoning as decideHealthCheckTransition taking nowIso. */
export function formatRelativeTime(iso: string | null, nowIso: string): string {
  if (!iso) return "—";
  const diffMs = new Date(nowIso).getTime() - new Date(iso).getTime();
  if (diffMs < 60_000) return "just now";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
