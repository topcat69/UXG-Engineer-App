import "server-only";
import PDFDocument from "pdfkit";
import { PAGE_MARGINS, drawBanner, drawFooters, drawSectionBar, twoColumnRow, loadLogoBytes } from "./brand";
import { drawReportTable } from "./report-table";
import { complianceRate, type SlaComplianceReportData, type SlaJobRow } from "@/lib/reports/sla-compliance-data";
import type { SlaJobOutcome } from "@/lib/reports/sla-compliance";

function outcomeLabel(outcome: SlaJobOutcome): string {
  if (outcome === "met") return "Met";
  if (outcome === "breached") return "Breached";
  return "Open";
}

function jobRow(r: SlaJobRow): string[] {
  return [
    r.jobNumber,
    r.clientName,
    r.siteName,
    r.fixtureTypeName,
    r.engineerName,
    r.targetHours == null ? "—" : `${r.targetHours}h`,
    r.durationHours == null ? "—" : `${r.durationHours.toFixed(1)}h`,
    outcomeLabel(r.outcome),
  ];
}

/**
 * Full-report PDF for the SLA compliance report page — headline stats,
 * both breakdown tables, and the per-job line list, in that order (same
 * order as the on-screen page). Built on the same PDFDocument/banner/
 * footer pattern as generateCompletionReport (completion-report.ts), with
 * drawReportTable (report-table.ts) supplying the table-grid rendering
 * that pattern never needed before this — SLA compliance's data is
 * already computed by fetchSlaComplianceReportData (shared with the
 * on-screen page and the CSV/XLSX exports), so this is presentation only.
 */
export async function generateSlaComplianceReportPdf(data: SlaComplianceReportData): Promise<Buffer> {
  const doc = new PDFDocument({ margins: PAGE_MARGINS, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const logo = loadLogoBytes();
  doc.on("pageAdded", () => drawBanner(doc, logo, "SLA Compliance Report"));
  drawBanner(doc, logo, "SLA Compliance Report");

  const { filters, headline, groupBreakdown, reasonBreakdown, rows, groupByLabel } = data;

  twoColumnRow(doc, ["Period:", `${filters.dateFrom} to ${filters.dateTo}`], ["Generated:", new Date().toLocaleString("en-GB")]);
  twoColumnRow(doc, ["Compliance rate:", complianceRate(headline)], ["Total SLA jobs:", String(rows.length)]);
  twoColumnRow(doc, ["Met:", String(headline.met)], ["Breached:", String(headline.breached)]);
  twoColumnRow(doc, ["Open / in flight:", String(headline.open)]);
  doc.moveDown(0.5);

  const breakdownColumns = [
    { label: groupByLabel, width: 200 },
    { label: "Met", width: 60, align: "right" as const },
    { label: "Breached", width: 70, align: "right" as const },
    { label: "Open", width: 60, align: "right" as const },
    { label: "Compliance", width: 90, align: "right" as const },
  ];

  drawSectionBar(doc, `Breakdown by ${groupByLabel}`);
  drawReportTable(
    doc,
    breakdownColumns,
    groupBreakdown.map((g) => [g.label, String(g.bucket.met), String(g.bucket.breached), String(g.bucket.open), complianceRate(g.bucket)]),
  );

  drawSectionBar(doc, "Breakdown by SLA reason");
  drawReportTable(
    doc,
    [{ ...breakdownColumns[0], label: "Reason" }, ...breakdownColumns.slice(1)],
    reasonBreakdown.map((g) => [g.label, String(g.bucket.met), String(g.bucket.breached), String(g.bucket.open), complianceRate(g.bucket)]),
  );

  drawSectionBar(doc, "Jobs");
  drawReportTable(
    doc,
    [
      { label: "Job #", width: 70 },
      { label: "Customer", width: 80 },
      { label: "Site", width: 60 },
      { label: "Fixture type", width: 80 },
      { label: "Engineer", width: 75 },
      { label: "Target", width: 45, align: "right" },
      { label: "Actual", width: 45, align: "right" },
      { label: "Outcome", width: 55, align: "right" },
    ],
    rows.map(jobRow),
  );

  drawFooters(doc);
  doc.end();
  return done;
}
