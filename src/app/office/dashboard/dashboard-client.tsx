"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { createClient } from "@/lib/supabase/client";
import {
  computeAverageTimeOnSiteMinutes,
  computeCompletedVsScheduled,
  computeEngineerWorkload,
  computeFirstTimeFixRate,
  computeOpenIssuesByAge,
  computeRevisitRateByCause,
  type DashboardIssue,
  type DashboardJob,
  type Engineer,
} from "@/lib/dashboard/metrics";

const CHART_COLOR = "#2563eb";

function jobsHref(params: Record<string, string>): string {
  return `/office/jobs?${new URLSearchParams(params).toString()}`;
}

export function DashboardClient({
  initialJobs,
  initialIssues,
  engineers,
}: {
  initialJobs: DashboardJob[];
  initialIssues: DashboardIssue[];
  engineers: Engineer[];
}) {
  const [jobs, setJobs] = useState(initialJobs);
  const [issues, setIssues] = useState(initialIssues);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const router = useRouter();

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const [{ data: freshJobs }, { data: freshIssues }] = await Promise.all([
      supabase
        .from("jobs")
        .select("id, status, parent_job_id, scheduled_start, actual_start, actual_end, assigned_to")
        .neq("status", "draft"),
      supabase.from("issues").select("job_id, category, status, revisit_job_id, created_at"),
    ]);
    if (freshJobs) setJobs(freshJobs);
    if (freshIssues) setIssues(freshIssues);
    setLastUpdated(new Date());
  }, []);

  // Every chart/stat here is computed fresh from a full refetch on any
  // change, rather than patched incrementally from the changed row —
  // simpler, and at this app's data scale (see dashboard/page.tsx) a full
  // refetch is still comfortably under the "within two seconds" budget the
  // spec sets, so there's no real cost to the simpler approach.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("dashboard-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "issues" }, refetch)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const firstTimeFix = computeFirstTimeFixRate(jobs);
  const completedVsScheduled = computeCompletedVsScheduled(jobs);
  const avgTimeOnSiteMinutes = computeAverageTimeOnSiteMinutes(jobs);
  const revisitByCause = computeRevisitRateByCause(issues);
  const openIssuesByAge = computeOpenIssuesByAge(issues, new Date().toISOString());
  const workload = computeEngineerWorkload(jobs, engineers);

  function jobIdsForCause(category: string): string[] {
    return issues
      .filter((i) => i.revisit_job_id !== null && (i.category ?? "uncategorised") === category)
      .map((i) => i.job_id)
      .filter((id): id is string => !!id);
  }

  function jobIdsForAgeBucket(label: string): string[] {
    const now = new Date().toISOString();
    return computeOpenIssuesByAgeIds(issues, now, label);
  }

  return (
    <div className="flex flex-col gap-6" data-testid="dashboard">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <span className="text-muted-foreground text-xs" data-testid="dashboard-updated">
          {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Live"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          testId="stat-first-time-fix"
          label="First-time fix rate"
          value={firstTimeFix.rate === null ? "—" : `${Math.round(firstTimeFix.rate * 100)}%`}
          detail={`${firstTimeFix.firstTimeFixCount} of ${firstTimeFix.totalClosedOriginals} closed jobs`}
          onClick={() => router.push(jobsHref({ status: "closed" }))}
        />
        <StatTile
          testId="stat-completed-vs-scheduled"
          label="Completed vs scheduled"
          value={`${completedVsScheduled.completed} / ${completedVsScheduled.scheduled}`}
          detail="completed / currently scheduled"
          onClick={() => router.push(jobsHref({ active: "true" }))}
        />
        <StatTile
          testId="stat-avg-time-on-site"
          label="Avg. time on site"
          value={avgTimeOnSiteMinutes === null ? "—" : `${Math.round(avgTimeOnSiteMinutes)} min`}
          detail="across closed jobs with recorded check-in/out"
          onClick={() => router.push(jobsHref({ status: "closed" }))}
        />
      </div>

      <ChartCard title="Engineer workload" subtitle="Active jobs per engineer right now">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={workload}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="engineerName" fontSize={12} />
            <YAxis allowDecimals={false} fontSize={12} />
            <Tooltip />
            <Bar
              dataKey="activeCount"
              fill={CHART_COLOR}
              cursor="pointer"
              onClick={(data) => {
                const engineerId = data.payload?.engineerId as string | undefined;
                if (engineerId) router.push(jobsHref({ assigned_to: engineerId, active: "true" }));
              }}
            >
              {workload.map((w) => (
                <Cell key={w.engineerId} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Revisit rate by cause" subtitle="Issue categories that triggered a revisit job">
        {revisitByCause.length === 0 ? (
          <p className="text-muted-foreground text-sm">No revisits yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revisitByCause}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" fontSize={12} />
              <YAxis allowDecimals={false} fontSize={12} />
              <Tooltip formatter={(value, name, item) => [`${value} (${Math.round(item.payload.rate * 100)}%)`, "Count"]} />
              <Bar
                dataKey="count"
                fill={CHART_COLOR}
                cursor="pointer"
                onClick={(data) => {
                  const category = data.payload?.category as string | undefined;
                  if (!category) return;
                  const ids = jobIdsForCause(category);
                  if (ids.length > 0) router.push(jobsHref({ ids: ids.join(",") }));
                }}
              >
                {revisitByCause.map((r) => (
                  <Cell key={r.category} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Open issues by age" subtitle="How long currently-open issues have been sitting">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={openIssuesByAge}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" fontSize={12} />
            <YAxis allowDecimals={false} fontSize={12} />
            <Tooltip />
            <Bar
              dataKey="count"
              fill={CHART_COLOR}
              cursor="pointer"
              onClick={(data) => {
                const label = data.payload?.label as string | undefined;
                if (!label) return;
                const ids = jobIdsForAgeBucket(label);
                if (ids.length > 0) router.push(jobsHref({ ids: ids.join(",") }));
              }}
            >
              {openIssuesByAge.map((b) => (
                <Cell key={b.label} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

/** Mirrors computeOpenIssuesByAge's own bucketing exactly (same day cutoffs) so a bucket's drill-through always matches what the chart just showed. */
function computeOpenIssuesByAgeIds(issues: DashboardIssue[], nowIso: string, label: string): string[] {
  const now = new Date(nowIso).getTime();
  const bucketRanges: Record<string, [number, number]> = {
    "0–7 days": [0, 7],
    "8–14 days": [7, 14],
    "15–30 days": [14, 30],
    "30+ days": [30, Infinity],
  };
  const range = bucketRanges[label];
  if (!range) return [];
  const [minDays, maxDays] = range;
  return issues
    .filter((i) => {
      if (i.status !== "open" || !i.created_at) return false;
      const ageDays = (now - new Date(i.created_at).getTime()) / (1000 * 60 * 60 * 24);
      return ageDays > minDays && ageDays <= maxDays;
    })
    .map((i) => i.job_id)
    .filter((id): id is string => !!id);
}

function StatTile({
  testId,
  label,
  value,
  detail,
  onClick,
}: {
  testId: string;
  label: string;
  value: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-1 rounded-md border p-4 text-left hover:bg-accent"
    >
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-2xl font-semibold" data-testid={testId}>
        {value}
      </span>
      <span className="text-muted-foreground text-xs">{detail}</span>
    </button>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border p-4">
      <h2 className="font-medium">{title}</h2>
      <p className="text-muted-foreground mb-2 text-xs">{subtitle}</p>
      {children}
    </div>
  );
}
