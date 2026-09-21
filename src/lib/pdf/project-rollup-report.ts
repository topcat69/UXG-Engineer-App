import "server-only";
import PDFDocument from "pdfkit";
import { PAGE_MARGINS, drawBanner, drawFooters, drawSectionBar, twoColumnRow, loadLogoBytes } from "./brand";
import { drawReportTable } from "./report-table";
import type { ProjectRollupReportData, ProjectRollupJobRow } from "@/lib/reports/project-rollup-data";
import { humanize } from "@/lib/format/text";

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function jobRow(r: ProjectRollupJobRow): string[] {
  return [r.jobNumber, r.siteName, humanize(r.status), r.engineerName, r.scheduledStart ? new Date(r.scheduledStart).toLocaleString("en-GB") : "—"];
}

/**
 * Full-report PDF for the Project rollup report page — headline stats,
 * status/throughput/group breakdowns, issues by state, and the per-job
 * line list, in the same order as the on-screen page. Same
 * PDFDocument/banner/footer/drawReportTable pattern as
 * sla-compliance-report.ts; data already computed by
 * fetchProjectRollupReportData (shared with the on-screen page and the
 * CSV/XLSX exports).
 */
export async function generateProjectRollupReportPdf(data: ProjectRollupReportData): Promise<Buffer> {
  const doc = new PDFDocument({ margins: PAGE_MARGINS, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const logo = loadLogoBytes();
  doc.on("pageAdded", () => drawBanner(doc, logo, "Project Rollup Report"));
  drawBanner(doc, logo, "Project Rollup Report");

  const { jobCount, workedMinutesTotal, travelMinutesTotal, issueCount, statusCounts, throughputByWeek, groupBreakdown, issueStatusCounts, rows, groupByLabel } =
    data;

  twoColumnRow(doc, ["Generated:", new Date().toLocaleString("en-GB")], ["Jobs in scope:", String(jobCount)]);
  twoColumnRow(doc, ["Worked time:", formatMinutes(workedMinutesTotal)], ["Travel time:", formatMinutes(travelMinutesTotal)]);
  twoColumnRow(doc, ["Issues raised:", String(issueCount)]);
  doc.moveDown(0.5);

  drawSectionBar(doc, "Jobs by status");
  drawReportTable(
    doc,
    [
      { label: "Status", width: 200 },
      { label: "Jobs", width: 80, align: "right" },
    ],
    statusCounts.map((s) => [s.label, String(s.count)]),
  );

  drawSectionBar(doc, "Throughput (jobs submitted per week)");
  drawReportTable(
    doc,
    [
      { label: "Week of", width: 200 },
      { label: "Jobs submitted", width: 100, align: "right" },
    ],
    throughputByWeek.map((t) => [new Date(t.week).toLocaleDateString("en-GB"), String(t.count)]),
  );

  drawSectionBar(doc, `Breakdown by ${groupByLabel}`);
  drawReportTable(
    doc,
    [
      { label: groupByLabel, width: 180 },
      { label: "Jobs", width: 60, align: "right" },
      { label: "Worked", width: 80, align: "right" },
      { label: "Travel", width: 80, align: "right" },
    ],
    groupBreakdown.map((g) => [g.label, String(g.jobCount), formatMinutes(g.workedMinutes), formatMinutes(g.travelMinutes)]),
  );

  drawSectionBar(doc, "Issues by state");
  drawReportTable(
    doc,
    [
      { label: "Status", width: 200 },
      { label: "Issues", width: 80, align: "right" },
    ],
    issueStatusCounts.map((i) => [humanize(i.status), String(i.count)]),
  );

  drawSectionBar(doc, "Jobs");
  drawReportTable(
    doc,
    [
      { label: "Job #", width: 80 },
      { label: "Site", width: 90 },
      { label: "Status", width: 85 },
      { label: "Engineer", width: 85 },
      { label: "Scheduled", width: 140 },
    ],
    rows.map(jobRow),
  );

  drawFooters(doc);
  doc.end();
  return done;
}
