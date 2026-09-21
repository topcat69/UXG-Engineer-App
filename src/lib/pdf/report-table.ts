import "server-only";
import { BRAND } from "./brand";

type Doc = PDFKit.PDFDocument;

export type ReportTableColumn = { label: string; width: number; align?: "left" | "right" };

const ROW_HEIGHT = 16;
const HEADER_HEIGHT = 18;

/**
 * A table grid — header row + one line per data row — the primitive
 * brand.ts never needed before (every existing helper there is shaped for
 * one job's single-column narrative, per the Report Generator Blueprint's
 * own note that this would be separate engineering). Each cell is a
 * single line (lineBreak: false, same fixed-row convention as
 * brand.ts's twoColumnRow) — every value passed in here is already
 * formatted to a short string by the caller.
 *
 * Paginates automatically: when the next row would run past the bottom
 * margin, starts a new page (the banner redraws itself via the
 * 'pageAdded' listener every caller already registers — see
 * completion-report.ts's own drawBanner wiring) and repeats the header
 * row there, so a long job list reads correctly split across pages.
 */
export function drawReportTable(doc: Doc, columns: ReportTableColumn[], rows: string[][]) {
  const x0 = doc.page.margins.left;
  const tableWidth = columns.reduce((sum, c) => sum + c.width, 0);

  function drawHeader() {
    const y = doc.y;
    doc.font("Helvetica-Bold").fontSize(8).fillColor(BRAND.charcoal);
    let x = x0;
    for (const col of columns) {
      doc.text(col.label.toUpperCase(), x, y, { width: col.width - 6, align: col.align ?? "left", lineBreak: false });
      x += col.width;
    }
    const ruleY = y + HEADER_HEIGHT - 4;
    doc.moveTo(x0, ruleY).lineTo(x0 + tableWidth, ruleY).strokeColor(BRAND.charcoal).lineWidth(1).stroke();
    doc.fillColor("black").font("Helvetica");
    doc.x = x0;
    doc.y = ruleY + 4;
  }

  drawHeader();

  if (rows.length === 0) {
    doc.font("Helvetica").fontSize(8).fillColor(BRAND.charcoal).text("No rows match these filters.", x0, doc.y, { width: tableWidth, lineBreak: false });
    doc.fillColor("black");
    doc.y += ROW_HEIGHT;
  }

  for (const row of rows) {
    if (doc.y + ROW_HEIGHT > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      drawHeader();
    }
    const y = doc.y;
    let x = x0;
    doc.font("Helvetica").fontSize(8).fillColor("black");
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      doc.text(row[i] ?? "—", x, y, { width: col.width - 6, align: col.align ?? "left", lineBreak: false });
      x += col.width;
    }
    doc.y = y + ROW_HEIGHT;
  }

  doc.x = x0;
  doc.moveDown(0.6);
}
