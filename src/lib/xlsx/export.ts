import "server-only";
import ExcelJS from "exceljs";
import { complianceRate, type SlaComplianceReportData } from "@/lib/reports/sla-compliance-data";
import type { ProjectRollupReportData } from "@/lib/reports/project-rollup-data";
import { humanize } from "@/lib/format/text";

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Multi-sheet workbook for the SLA compliance report — a Summary sheet
 * (the headline stats), then one sheet per breakdown table, then a Jobs
 * sheet with the same flat per-job line list slaComplianceToCsv exports.
 * Built from the exact same fetchSlaComplianceReportData result the page
 * and every other export format use, so the numbers can't drift apart.
 */
export async function slaComplianceToXlsx(data: SlaComplianceReportData): Promise<Buffer> {
  const { filters, headline, groupBreakdown, reasonBreakdown, rows, groupByLabel } = data;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "UXG Engineer App";
  workbook.created = new Date();

  const summary = workbook.addWorksheet("Summary");
  summary.columns = [{ header: "Metric", key: "metric", width: 28 }, { header: "Value", key: "value", width: 24 }];
  summary.addRows([
    { metric: "Period", value: `${filters.dateFrom} to ${filters.dateTo}` },
    { metric: "Compliance rate", value: complianceRate(headline) },
    { metric: "Met", value: headline.met },
    { metric: "Breached", value: headline.breached },
    { metric: "Open / in flight", value: headline.open },
    { metric: "Total SLA jobs", value: rows.length },
  ]);
  summary.getRow(1).font = { bold: true };

  const groupSheet = workbook.addWorksheet(`By ${groupByLabel}`.slice(0, 31));
  groupSheet.columns = [
    { header: groupByLabel, key: "label", width: 28 },
    { header: "Met", key: "met", width: 10 },
    { header: "Breached", key: "breached", width: 10 },
    { header: "Open", key: "open", width: 10 },
    { header: "Compliance", key: "compliance", width: 12 },
  ];
  groupSheet.addRows(groupBreakdown.map((g) => ({ label: g.label, met: g.bucket.met, breached: g.bucket.breached, open: g.bucket.open, compliance: complianceRate(g.bucket) })));
  groupSheet.getRow(1).font = { bold: true };

  const reasonSheet = workbook.addWorksheet("Reason breakdown");
  reasonSheet.columns = [
    { header: "Reason", key: "label", width: 28 },
    { header: "Met", key: "met", width: 10 },
    { header: "Breached", key: "breached", width: 10 },
    { header: "Open", key: "open", width: 10 },
    { header: "Compliance", key: "compliance", width: 12 },
  ];
  reasonSheet.addRows(reasonBreakdown.map((g) => ({ label: g.label, met: g.bucket.met, breached: g.bucket.breached, open: g.bucket.open, compliance: complianceRate(g.bucket) })));
  reasonSheet.getRow(1).font = { bold: true };

  const jobsSheet = workbook.addWorksheet("Jobs");
  jobsSheet.columns = [
    { header: "Job #", key: "job_number", width: 16 },
    { header: "Customer", key: "customer", width: 20 },
    { header: "Site", key: "site", width: 16 },
    { header: "Fixture type", key: "fixture_type", width: 18 },
    { header: "Engineer", key: "engineer", width: 18 },
    { header: "Target (h)", key: "target", width: 12 },
    { header: "Actual (h)", key: "actual", width: 12 },
    { header: "Outcome", key: "outcome", width: 12 },
  ];
  jobsSheet.addRows(
    rows.map((r) => ({
      job_number: r.jobNumber,
      customer: r.clientName,
      site: r.siteName,
      fixture_type: r.fixtureTypeName,
      engineer: r.engineerName,
      target: r.targetHours,
      actual: r.durationHours == null ? null : Number(r.durationHours.toFixed(1)),
      outcome: r.outcome,
    })),
  );
  jobsSheet.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Multi-sheet workbook for the Project rollup report — Summary, Status
 * breakdown, Weekly throughput, the chosen group-by breakdown, Issues by
 * state, and a Jobs sheet — same data source as the on-screen page and
 * every other export format.
 */
export async function projectRollupToXlsx(data: ProjectRollupReportData): Promise<Buffer> {
  const { jobCount, workedMinutesTotal, travelMinutesTotal, issueCount, statusCounts, throughputByWeek, groupBreakdown, issueStatusCounts, rows, groupByLabel } =
    data;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "UXG Engineer App";
  workbook.created = new Date();

  const summary = workbook.addWorksheet("Summary");
  summary.columns = [{ header: "Metric", key: "metric", width: 24 }, { header: "Value", key: "value", width: 24 }];
  summary.addRows([
    { metric: "Jobs in scope", value: jobCount },
    { metric: "Worked time", value: formatMinutes(workedMinutesTotal) },
    { metric: "Travel time", value: formatMinutes(travelMinutesTotal) },
    { metric: "Issues raised", value: issueCount },
  ]);
  summary.getRow(1).font = { bold: true };

  const statusSheet = workbook.addWorksheet("Status counts");
  statusSheet.columns = [{ header: "Status", key: "label", width: 20 }, { header: "Jobs", key: "count", width: 10 }];
  statusSheet.addRows(statusCounts.map((s) => ({ label: s.label, count: s.count })));
  statusSheet.getRow(1).font = { bold: true };

  const throughputSheet = workbook.addWorksheet("Throughput");
  throughputSheet.columns = [{ header: "Week of", key: "week", width: 16 }, { header: "Jobs submitted", key: "count", width: 16 }];
  throughputSheet.addRows(throughputByWeek.map((t) => ({ week: t.week, count: t.count })));
  throughputSheet.getRow(1).font = { bold: true };

  const groupSheet = workbook.addWorksheet(`By ${groupByLabel}`.slice(0, 31));
  groupSheet.columns = [
    { header: groupByLabel, key: "label", width: 24 },
    { header: "Jobs", key: "jobs", width: 10 },
    { header: "Worked", key: "worked", width: 14 },
    { header: "Travel", key: "travel", width: 14 },
  ];
  groupSheet.addRows(groupBreakdown.map((g) => ({ label: g.label, jobs: g.jobCount, worked: formatMinutes(g.workedMinutes), travel: formatMinutes(g.travelMinutes) })));
  groupSheet.getRow(1).font = { bold: true };

  const issuesSheet = workbook.addWorksheet("Issues by state");
  issuesSheet.columns = [{ header: "Status", key: "label", width: 20 }, { header: "Issues", key: "count", width: 10 }];
  issuesSheet.addRows(issueStatusCounts.map((i) => ({ label: humanize(i.status), count: i.count })));
  issuesSheet.getRow(1).font = { bold: true };

  const jobsSheet = workbook.addWorksheet("Jobs");
  jobsSheet.columns = [
    { header: "Job #", key: "job_number", width: 16 },
    { header: "Site", key: "site", width: 16 },
    { header: "Status", key: "status", width: 14 },
    { header: "Engineer", key: "engineer", width: 18 },
    { header: "Scheduled", key: "scheduled", width: 20 },
  ];
  jobsSheet.addRows(
    rows.map((r) => ({
      job_number: r.jobNumber,
      site: r.siteName,
      status: humanize(r.status),
      engineer: r.engineerName,
      scheduled: r.scheduledStart ? new Date(r.scheduledStart).toLocaleString("en-GB") : "—",
    })),
  );
  jobsSheet.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
