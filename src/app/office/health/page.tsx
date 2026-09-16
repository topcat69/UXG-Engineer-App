import { requireSuperadminUser } from "@/lib/auth/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  groupHealthChecks,
  summarizeHealthChecks,
  formatRelativeTime,
  type HealthCheckRow,
  type HealthCheckItem,
} from "@/lib/health/health-checks-view";
import { CheckNowButton } from "./check-now-button";

const GOOD = "#2f6b4c";
const CRIT = "#963f3f";

/**
 * Watchdog Phase 4 (see the "Watchdog" scoping memo) — a superadmin-only
 * read of health_checks, the same table the alert emails come from.
 * health_checks has no RLS policies at all (same posture as
 * app_settings/cron_heartbeats/integration_failures), so this reads via
 * the admin client and enforces "superadmin only" itself, the same way
 * UsersPage already does for auth.admin.listUsers.
 */
export default async function HealthPage() {
  await requireSuperadminUser();

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("health_checks")
    .select("key, is_healthy, last_detail, last_ok_at, last_fail_at, last_notified_at, updated_at")
    .order("key");
  if (error) console.error("Watchdog: /office/health failed to read health_checks", error);

  const checks: HealthCheckRow[] = data ?? [];
  const groups = groupHealthChecks(checks);
  const { healthy, unhealthy } = summarizeHealthChecks(checks);
  const nowIso = new Date().toISOString();
  const lastSwept = checks.reduce<string | null>((latest, row) => (!latest || row.updated_at > latest ? row.updated_at : latest), null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Watchdog</h1>
          <p className="text-muted-foreground text-sm">
            Reads straight from <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">health_checks</code> — the same table the
            alert emails come from. Nothing here is stored separately.
          </p>
        </div>
        <CheckNowButton />
      </div>

      {checks.length === 0 ? (
        <p className="text-muted-foreground rounded-md border p-4 text-sm">
          No health data yet — waiting for the first{" "}
          <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">/api/cron/health-check</code> run.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <SummaryStat label="Healthy" value={healthy} color={GOOD} />
            <SummaryStat label="Unhealthy" value={unhealthy} color={unhealthy > 0 ? CRIT : undefined} />
            <div className="rounded-md border p-4">
              <span className="text-muted-foreground text-xs">Last swept</span>
              <div className="mt-1 font-mono text-sm">{formatRelativeTime(lastSwept, nowIso)}</div>
            </div>
          </div>

          <CheckGroup title="Core" note="every 15 min" items={groups.core} nowIso={nowIso} />
          <CheckGroup title="Scheduled jobs" note="checked against each cron's own cadence" items={groups.crons} nowIso={nowIso} />
          <CheckGroup title="Integrations" note="only checked when configured" items={groups.integrations} nowIso={nowIso} />
          <CheckGroup title="Other" note="" items={groups.other} nowIso={nowIso} />
        </>
      )}
    </div>
  );
}

function SummaryStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-md border p-4">
      <span className="text-muted-foreground text-xs">{label}</span>
      <div className="mt-1 text-2xl font-semibold" style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}

function CheckGroup({ title, note, items, nowIso }: { title: string; note: string; items: HealthCheckItem[]; nowIso: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between px-1">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">{title}</h2>
        {note && <span className="text-muted-foreground text-xs">{note}</span>}
      </div>
      <div className="divide-y rounded-md border">
        {items.map((item) => (
          <div key={item.key} className="flex items-center gap-3 px-4 py-3">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: item.is_healthy ? GOOD : CRIT }}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{item.label}</div>
              <div className="text-muted-foreground truncate font-mono text-xs">{item.last_detail ?? "—"}</div>
            </div>
            <div className="text-muted-foreground shrink-0 text-right text-xs">
              <div className="font-mono" style={!item.is_healthy ? { color: CRIT } : undefined}>
                {item.is_healthy ? "healthy" : "unhealthy"}
              </div>
              <div className="font-mono">{formatRelativeTime(item.is_healthy ? item.last_ok_at : item.last_fail_at, nowIso)}</div>
              {item.is_healthy && item.last_fail_at && <div className="font-mono">failed {formatRelativeTime(item.last_fail_at, nowIso)}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
