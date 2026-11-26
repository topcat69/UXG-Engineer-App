import "server-only";
import PDFDocument from "pdfkit";
import { PAGE_MARGINS, drawBanner, drawFooters, drawSectionBar, twoColumnRow, loadLogoBytes } from "./brand";
import { drawReportTable } from "./report-table";
import type { AssetRegisterReportData, AssetRegisterAssetRow } from "@/lib/reports/asset-register-data";
import { formatGbp } from "@/lib/format/currency";
import { humanize } from "@/lib/format/text";

function assetRow(r: AssetRegisterAssetRow): string[] {
  return [
    r.itemLabel + (r.serialNumber ? ` — ${r.serialNumber}` : ""),
    r.categoryName ?? "—",
    r.clientName ?? "—",
    r.siteName ?? "—",
    humanize(r.status),
    formatGbp(r.purchaseCost),
  ];
}

/**
 * Full-report PDF for the Asset Register report page — headline stats,
 * status/category breakdowns, then the full per-asset line list, in the
 * same order as the on-screen page. Same PDFDocument/banner/footer/
 * drawReportTable pattern as sla-compliance-report.ts/project-rollup-
 * report.ts; data already computed by fetchAssetRegisterReportData
 * (shared with the on-screen page and the CSV/XLSX exports).
 */
export async function generateAssetRegisterReportPdf(data: AssetRegisterReportData): Promise<Buffer> {
  const doc = new PDFDocument({ margins: PAGE_MARGINS, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const logo = loadLogoBytes();
  doc.on("pageAdded", () => drawBanner(doc, logo, "Asset Register Report"));
  drawBanner(doc, logo, "Asset Register Report");

  const { totalAssets, statusCounts, categoryBreakdown, totalPurchaseCost, costedCount, rows } = data;

  twoColumnRow(doc, ["Generated:", new Date().toLocaleString("en-GB")], ["Total assets:", String(totalAssets)]);
  twoColumnRow(doc, ["Total purchase cost:", formatGbp(totalPurchaseCost)], ["Assets costed:", `${costedCount} of ${totalAssets}`]);
  doc.moveDown(0.5);

  drawSectionBar(doc, "By status");
  drawReportTable(
    doc,
    [
      { label: "Status", width: 200 },
      { label: "Assets", width: 80, align: "right" },
    ],
    statusCounts.map((s) => [s.label, String(s.count)]),
  );

  drawSectionBar(doc, "By category");
  drawReportTable(
    doc,
    [
      { label: "Category", width: 200 },
      { label: "Assets", width: 80, align: "right" },
    ],
    categoryBreakdown.map((c) => [c.label, String(c.count)]),
  );

  drawSectionBar(doc, "Assets");
  drawReportTable(
    doc,
    [
      { label: "Item", width: 150 },
      { label: "Category", width: 80 },
      { label: "Customer", width: 80 },
      { label: "Site", width: 80 },
      { label: "Status", width: 65 },
      { label: "Cost", width: 60, align: "right" },
    ],
    rows.map(assetRow),
  );

  drawFooters(doc);
  doc.end();
  return done;
}
