import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/office/stat-tile";
import { createClient } from "@/lib/supabase/server";
import { classifySlaJob, type SlaJobOutcome } from "@/lib/reports/sla-compliance";

type SearchParams = Record<string, string | string[] | undefined>;

type GroupBy = "engineer" | "site" | "fixture_type" | "client" | "reason";
const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: "fixture_type", label: "Fixture type" },
  { value: "reason", label: "SLA reason" },
  { value: "engineer", label: "Engineer" },
  { value: "site", label: "Site" },
  { value: "client", label: "Customer" },
];

function param(sp: SearchParams, key: string): string {
  const value = sp[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function isoDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function outcomeBadge(outcome: SlaJobOutcome) {
  if (outcome === "met") return <Badge variant="secondary">Met</Badge>;
  if (outcome === "breached") return <Badge variant="destructive">Breached</Badge>;
  return <Badge variant="outline">Open</Badge>;
}

function formatHours(hours: number | null): string {
  return hours == null ? "—" : `${hours.toFixed(1)}h`;
}

type Bucket = { met: number; breached: number; open: number };
function emptyBucket(): Bucket {
  return { met: 0, breached: 0, open: 0 };
}
function addToBucket(bucket: Bucket, outcome: SlaJobOutcome) {
  bucket[outcome] += 1;
}
function complianceRate(bucket: Bucket): string {
  const classified = bucket.met + bucket.breached;
  return classified === 0 ? "—" : `${Math.round((bucket.met / classified) * 100)}%`;
}

/**
 * SLA compliance report — Report Generator Phase 1, per the Report
 * Generator Blueprint. Scoped to job_type "sla" only (see createSlaJob in
 * office/sla/actions.ts — the only jobs a per-client SLA target means
 * anything for). Classification itself (met/breached/open, the clock,
 * pauses counting against it) lives in lib/reports/sla-compliance.ts,
 * unit-tested there; this page is query + grouping + presentation, same
 * split as worked-duration.ts feeding the Timesheets page.
 *
 * Date range filters on jobs.created_at (the logging/cohort question) —
 * deliberately separate from the clock the classification itself measures
 * (actual_start -> submitted_at), per the blueprint's explicit distinction.
 */
export default async function SlaComplianceReportPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const today = new Date();
  const dateFrom = param(sp, "date_from") || isoDateOnly(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000));
  const dateTo = param(sp, "date_to") || isoDateOnly(today);
  const clientId = param(sp, "client_id");
  const siteId = param(sp, "site_id");
  const fixtureTypeId = param(sp, "fixture_type_id");
  const reasonId = param(sp, "reason_id");
  const assignedTo = param(sp, "assigned_to");
  const projectId = param(sp, "project_id");
  const groupBy = (param(sp, "group_by") || "fixture_type") as GroupBy;

  const supabase = await createClient();

  const clientSiteIds = clientId
    ? ((await supabase.from("sites").select("id").eq("client_id", clientId)).data?.map((s) => s.id) ?? [])
    : null;

  let query = supabase
    .from("jobs")
    .select(
      `id, job_number, created_at, actual_start, assigned_to,
       assigned:users!jobs_assigned_to_fkey(id, name),
       site:sites(id, name, client:clients(id, name, sla_target_hours)),
       job_details(submitted_at, fixture_type_id, reason_id,
         fixture_type:client_sla_fixture_types(id, name),
         reason:client_sla_reasons(id, name))`,
    )
    .eq("job_type", "sla")
    .gte("created_at", `${dateFrom}T00:00:00`)
    .lte("created_at", `${dateTo}T23:59:59`)
    .order("created_at", { ascending: false });
  if (siteId) query = query.eq("site_id", siteId);
  if (assignedTo) query = query.eq("assigned_to", assignedTo);
  if (projectId) query = query.eq("project_id", projectId);
  if (clientSiteIds) query = query.in("site_id", clientSiteIds.length > 0 ? clientSiteIds : ["00000000-0000-0000-0000-000000000000"]);

  const [{ data: jobs, error }, { data: clients }, { data: sites }, { data: engineers }, { data: projects }] = await Promise.all([
    query,
    supabase.from("clients").select("id, name").order("name"),
    supabase.from("sites").select("id, name, client_id").order("name"),
    supabase.from("users").select("id, name").in("role", ["engineer", "manager", "superadmin"]).eq("active", true).order("name"),
    supabase.from("projects").select("id, name").order("name"),
  ]);

  if (error) {
    return <p className="text-destructive">Failed to load the SLA compliance report: {error.message}</p>;
  }

  // fixture_type_id/reason_id live on job_details (a child table), so
  // they're applied here rather than as query filters — same reasoning
  // list-query.ts documents for clientId not being a jobs column: nothing
  // to .eq() against on the jobs table itself.
  const allRows = jobs ?? [];
  const filteredRows = allRows.filter((job) => {
    const details = job.job_details;
    if (fixtureTypeId && details?.fixture_type_id !== fixtureTypeId) return false;
    if (reasonId && details?.reason_id !== reasonId) return false;
    return true;
  });

  const now = new Date();
  const rows = filteredRows.map((job) => {
    const details = job.job_details;
    const targetHours = job.site?.client?.sla_target_hours ?? null;
    const result = classifySlaJob({ actualStart: job.actual_start, submittedAt: details?.submitted_at ?? null, targetHours }, now);
    return { job, details, targetHours, ...result };
  });

  const headline = emptyBucket();
  rows.forEach((r) => addToBucket(headline, r.outcome));

  const groupKeyLabel = new Map<string, string>();
  function groupKeyFor(r: (typeof rows)[number]): string {
    switch (groupBy) {
      case "engineer":
        return r.job.assigned?.id ?? "unassigned";
      case "site":
        return r.job.site?.id ?? "unknown";
      case "client":
        return r.job.site?.client?.id ?? "unknown";
      case "reason":
        return r.details?.reason?.id ?? "none";
      case "fixture_type":
      default:
        return r.details?.fixture_type?.id ?? "none";
    }
  }
  function groupLabelFor(r: (typeof rows)[number]): string {
    switch (groupBy) {
      case "engineer":
        return r.job.assigned?.name ?? "Unassigned";
      case "site":
        return r.job.site?.name ?? "Unknown site";
      case "client":
        return r.job.site?.client?.name ?? "Unknown customer";
      case "reason":
        return r.details?.reason?.name ?? "No reason set";
      case "fixture_type":
      default:
        return r.details?.fixture_type?.name ?? "No fixture type set";
    }
  }

  const groupBuckets = new Map<string, Bucket>();
  for (const r of rows) {
    const key = groupKeyFor(r);
    groupKeyLabel.set(key, groupLabelFor(r));
    const bucket = groupBuckets.get(key) ?? emptyBucket();
    addToBucket(bucket, r.outcome);
    groupBuckets.set(key, bucket);
  }
  const groupBreakdown = Array.from(groupBuckets.entries())
    .map(([key, bucket]) => ({ key, label: groupKeyLabel.get(key)!, bucket }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const reasonBuckets = new Map<string, { label: string; bucket: Bucket }>();
  for (const r of rows) {
    const key = r.details?.reason?.id ?? "none";
    const label = r.details?.reason?.name ?? "No reason set";
    const entry = reasonBuckets.get(key) ?? { label, bucket: emptyBucket() };
    addToBucket(entry.bucket, r.outcome);
    reasonBuckets.set(key, entry);
  }
  const reasonBreakdown = Array.from(reasonBuckets.values()).sort((a, b) => a.label.localeCompare(b.label));

  const hasFilters = !!(clientId || siteId || fixtureTypeId || reasonId || assignedTo || projectId);
  const baseParams = { date_from: dateFrom, date_to: dateTo, group_by: groupBy };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">SLA Compliance Report</h1>
          <p className="text-muted-foreground text-sm">
            SLA jobs logged {dateFrom} to {dateTo} — met/breached measured from the engineer starting the job to
            submitting it, against each customer&apos;s SLA target. Pauses count against the clock.
          </p>
        </div>
        <div className="flex gap-3 text-sm whitespace-nowrap">
          <Link href="/office/reports" className="underline-offset-2 hover:underline">
            Completed Jobs
          </Link>
          <Link href="/office/reports/project-rollup" className="underline-offset-2 hover:underline">
            Project rollup
          </Link>
        </div>
      </div>

      <form className="flex flex-wrap items-end gap-2" method="get">
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs" htmlFor="date_from">
            From
          </label>
          <input
            id="date_from"
            type="date"
            name="date_from"
            defaultValue={dateFrom}
            className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs" htmlFor="date_to">
            To
          </label>
          <input
            id="date_to"
            type="date"
            name="date_to"
            defaultValue={dateTo}
            className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs" htmlFor="client_id">
            Customer
          </label>
          <select id="client_id" name="client_id" defaultValue={clientId} className="border-input h-9 rounded-md border bg-transparent px-3 text-sm">
            <option value="">All</option>
            {(clients ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs" htmlFor="site_id">
            Site
          </label>
          <select id="site_id" name="site_id" defaultValue={siteId} className="border-input h-9 rounded-md border bg-transparent px-3 text-sm">
            <option value="">All</option>
            {(sites ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs" htmlFor="assigned_to">
            Engineer
          </label>
          <select id="assigned_to" name="assigned_to" defaultValue={assignedTo} className="border-input h-9 rounded-md border bg-transparent px-3 text-sm">
            <option value="">Anyone</option>
            {(engineers ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs" htmlFor="project_id">
            Project
          </label>
          <select id="project_id" name="project_id" defaultValue={projectId} className="border-input h-9 rounded-md border bg-transparent px-3 text-sm">
            <option value="">All</option>
            {(projects ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs" htmlFor="group_by">
            Group by
          </label>
          <select id="group_by" name="group_by" defaultValue={groupBy} className="border-input h-9 rounded-md border bg-transparent px-3 text-sm">
            {GROUP_BY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="border-input h-9 rounded-md border px-4 text-sm hover:bg-accent">
          Filter
        </button>
        {hasFilters && (
          <Link href={`/office/reports/sla-compliance?${new URLSearchParams(baseParams).toString()}`} className="text-muted-foreground text-sm underline">
            Clear filters
          </Link>
        )}
      </form>

      <div className="flex flex-wrap gap-4">
        <StatTile label="Compliance rate" value={complianceRate(headline)} detail={`${headline.met} met, ${headline.breached} breached`} />
        <StatTile label="Open / in flight" value={String(headline.open)} />
        <StatTile label="Total SLA jobs" value={String(rows.length)} />
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold">
          Breakdown by {GROUP_BY_OPTIONS.find((o) => o.value === groupBy)?.label.toLowerCase()}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 font-medium">{GROUP_BY_OPTIONS.find((o) => o.value === groupBy)?.label}</th>
                <th className="py-2 font-medium">Met</th>
                <th className="py-2 font-medium">Breached</th>
                <th className="py-2 font-medium">Open</th>
                <th className="py-2 font-medium">Compliance</th>
              </tr>
            </thead>
            <tbody>
              {groupBreakdown.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-muted-foreground py-4 text-center">
                    No SLA jobs match these filters.
                  </td>
                </tr>
              )}
              {groupBreakdown.map((g) => (
                <tr key={g.key} className="border-b">
                  <td className="py-2">{g.label}</td>
                  <td className="py-2 tabular-nums">{g.bucket.met}</td>
                  <td className="py-2 tabular-nums">{g.bucket.breached}</td>
                  <td className="py-2 tabular-nums">{g.bucket.open}</td>
                  <td className="py-2 tabular-nums">{complianceRate(g.bucket)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold">Breakdown by SLA reason</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 font-medium">Reason</th>
                <th className="py-2 font-medium">Met</th>
                <th className="py-2 font-medium">Breached</th>
                <th className="py-2 font-medium">Open</th>
                <th className="py-2 font-medium">Compliance</th>
              </tr>
            </thead>
            <tbody>
              {reasonBreakdown.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-muted-foreground py-4 text-center">
                    No SLA jobs match these filters.
                  </td>
                </tr>
              )}
              {reasonBreakdown.map((g) => (
                <tr key={g.label} className="border-b">
                  <td className="py-2">{g.label}</td>
                  <td className="py-2 tabular-nums">{g.bucket.met}</td>
                  <td className="py-2 tabular-nums">{g.bucket.breached}</td>
                  <td className="py-2 tabular-nums">{g.bucket.open}</td>
                  <td className="py-2 tabular-nums">{complianceRate(g.bucket)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold">Jobs</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 font-medium">Job #</th>
                <th className="py-2 font-medium">Customer</th>
                <th className="py-2 font-medium">Site</th>
                <th className="py-2 font-medium">Fixture type</th>
                <th className="py-2 font-medium">Engineer</th>
                <th className="py-2 font-medium">Target</th>
                <th className="py-2 font-medium">Actual</th>
                <th className="py-2 font-medium">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-muted-foreground py-6 text-center">
                    No SLA jobs match these filters.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.job.id} className="border-b">
                  <td className="py-2">
                    <Link href={`/office/jobs/${r.job.id}`} className="font-medium underline-offset-2 hover:underline">
                      {r.job.job_number}
                    </Link>
                  </td>
                  <td className="py-2 text-muted-foreground">{r.job.site?.client?.name ?? "—"}</td>
                  <td className="py-2 text-muted-foreground">{r.job.site?.name ?? "—"}</td>
                  <td className="py-2 text-muted-foreground">{r.details?.fixture_type?.name ?? "—"}</td>
                  <td className="py-2 text-muted-foreground">{r.job.assigned?.name ?? "Unassigned"}</td>
                  <td className="py-2 tabular-nums">{r.targetHours == null ? "No target set" : `${r.targetHours}h`}</td>
                  <td className="py-2 tabular-nums">{formatHours(r.durationHours)}</td>
                  <td className="py-2">{outcomeBadge(r.outcome)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
