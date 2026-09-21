import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { classifySlaJob, type SlaJobOutcome } from "./sla-compliance";

type AnySupabaseClient = SupabaseClient<Database>;

export type GroupBy = "engineer" | "site" | "fixture_type" | "client" | "reason";
export const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: "fixture_type", label: "Fixture type" },
  { value: "reason", label: "SLA reason" },
  { value: "engineer", label: "Engineer" },
  { value: "site", label: "Site" },
  { value: "client", label: "Customer" },
];

export type SlaComplianceFilters = {
  dateFrom: string;
  dateTo: string;
  clientId: string;
  siteId: string;
  fixtureTypeId: string;
  reasonId: string;
  assignedTo: string;
  projectId: string;
  groupBy: GroupBy;
};

export type Bucket = { met: number; breached: number; open: number };
function emptyBucket(): Bucket {
  return { met: 0, breached: 0, open: 0 };
}
function addToBucket(bucket: Bucket, outcome: SlaJobOutcome) {
  bucket[outcome] += 1;
}
export function complianceRate(bucket: Bucket): string {
  const classified = bucket.met + bucket.breached;
  return classified === 0 ? "—" : `${Math.round((bucket.met / classified) * 100)}%`;
}

export type SlaJobRow = {
  jobId: string;
  jobNumber: string;
  clientName: string;
  siteName: string;
  fixtureTypeName: string;
  engineerName: string;
  targetHours: number | null;
  durationHours: number | null;
  outcome: SlaJobOutcome;
};

export type LabelledBucket = { key: string; label: string; bucket: Bucket };

export type SlaComplianceReportData = {
  filters: SlaComplianceFilters;
  groupByLabel: string;
  headline: Bucket;
  groupBreakdown: LabelledBucket[];
  reasonBreakdown: LabelledBucket[];
  rows: SlaJobRow[];
};

export type SlaComplianceReportResult = { ok: true; data: SlaComplianceReportData } | { ok: false; message: string };

/**
 * The SLA compliance report's own query + classification + grouping,
 * pulled out of the page component so the on-screen report and every
 * export format (PDF/XLSX/CSV/zip) run from exactly one query — same
 * "export matches what's on screen" guarantee /api/export/jobs already
 * documents for the jobs list. Only the filter *option* lists (which
 * clients/sites/engineers/projects to show in the dropdowns) stay in the
 * page itself — exports don't need them.
 */
export async function fetchSlaComplianceReportData(
  supabase: AnySupabaseClient,
  filters: SlaComplianceFilters,
): Promise<SlaComplianceReportResult> {
  const { dateFrom, dateTo, clientId, siteId, fixtureTypeId, reasonId, assignedTo, projectId, groupBy } = filters;

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

  const { data: jobs, error } = await query;
  if (error) return { ok: false, message: error.message };

  // fixture_type_id/reason_id live on job_details (a child table), so
  // they're applied here rather than as query filters — same reasoning
  // list-query.ts documents for clientId not being a jobs column.
  const filteredRows = (jobs ?? []).filter((job) => {
    const details = job.job_details;
    if (fixtureTypeId && details?.fixture_type_id !== fixtureTypeId) return false;
    if (reasonId && details?.reason_id !== reasonId) return false;
    return true;
  });

  const now = new Date();
  const classified = filteredRows.map((job) => {
    const details = job.job_details;
    const targetHours = job.site?.client?.sla_target_hours ?? null;
    const result = classifySlaJob({ actualStart: job.actual_start, submittedAt: details?.submitted_at ?? null, targetHours }, now);
    return { job, details, targetHours, ...result };
  });

  const headline = emptyBucket();
  classified.forEach((r) => addToBucket(headline, r.outcome));

  function groupKeyAndLabel(r: (typeof classified)[number]): [string, string] {
    switch (groupBy) {
      case "engineer":
        return [r.job.assigned?.id ?? "unassigned", r.job.assigned?.name ?? "Unassigned"];
      case "site":
        return [r.job.site?.id ?? "unknown", r.job.site?.name ?? "Unknown site"];
      case "client":
        return [r.job.site?.client?.id ?? "unknown", r.job.site?.client?.name ?? "Unknown customer"];
      case "reason":
        return [r.details?.reason?.id ?? "none", r.details?.reason?.name ?? "No reason set"];
      case "fixture_type":
      default:
        return [r.details?.fixture_type?.id ?? "none", r.details?.fixture_type?.name ?? "No fixture type set"];
    }
  }

  const groupBuckets = new Map<string, LabelledBucket>();
  for (const r of classified) {
    const [key, label] = groupKeyAndLabel(r);
    const entry = groupBuckets.get(key) ?? { key, label, bucket: emptyBucket() };
    addToBucket(entry.bucket, r.outcome);
    groupBuckets.set(key, entry);
  }
  const groupBreakdown = Array.from(groupBuckets.values()).sort((a, b) => a.label.localeCompare(b.label));

  const reasonBuckets = new Map<string, LabelledBucket>();
  for (const r of classified) {
    const key = r.details?.reason?.id ?? "none";
    const label = r.details?.reason?.name ?? "No reason set";
    const entry = reasonBuckets.get(key) ?? { key, label, bucket: emptyBucket() };
    addToBucket(entry.bucket, r.outcome);
    reasonBuckets.set(key, entry);
  }
  const reasonBreakdown = Array.from(reasonBuckets.values()).sort((a, b) => a.label.localeCompare(b.label));

  const rows: SlaJobRow[] = classified.map((r) => ({
    jobId: r.job.id,
    jobNumber: r.job.job_number,
    clientName: r.job.site?.client?.name ?? "—",
    siteName: r.job.site?.name ?? "—",
    fixtureTypeName: r.details?.fixture_type?.name ?? "—",
    engineerName: r.job.assigned?.name ?? "Unassigned",
    targetHours: r.targetHours,
    durationHours: r.durationHours,
    outcome: r.outcome,
  }));

  return {
    ok: true,
    data: {
      filters,
      groupByLabel: GROUP_BY_OPTIONS.find((o) => o.value === groupBy)?.label ?? "Fixture type",
      headline,
      groupBreakdown,
      reasonBreakdown,
      rows,
    },
  };
}
