import "server-only";
import fs from "node:fs";
import path from "node:path";
import { BRAND } from "./brand-colors";
import { severityAccent } from "./severity";
import { TILE_SIZE, type SiteMapPlan } from "./site-map";

export { BRAND, severityAccent };

/**
 * The pale-grey-on-dark variant of the UXG logo, per the Brand Manual's
 * own "Colour Alternatives" rule (Section 1): "When on a dark or coloured
 * background, the UXG logo changes to pale grey lettering, retaining the
 * colour in the colour bar." The banner it sits on (drawBanner, below) is
 * a charcoal gradient, so the normal charcoal-on-transparent logo
 * (`uxg-logo.png`, what the office UI renders on its own light chrome)
 * would be almost invisible there. Generated once from that same source
 * file by recolouring only the wordmark's charcoal pixels to the manual's
 * pale grey (`#E4E4E7`) and leaving the bar's three brand colours
 * untouched — not a second hand-exported asset that could drift out of
 * sync with the original. `process.cwd()` is the app root both under
 * `next dev` and in the standalone Docker runtime (see Dockerfile:
 * `WORKDIR /app`, `COPY --from=builder /app/public ./public`), so this
 * resolves the same way in both.
 */
export function loadLogoBytes(): Buffer {
  return fs.readFileSync(path.join(process.cwd(), "public/branding/uxg-logo-white.png"));
}

type Doc = PDFKit.PDFDocument;

const BANNER_HEIGHT = 62;
const FOOTER_HEIGHT = 40;
export const PAGE_MARGINS = { top: BANNER_HEIGHT + 24, bottom: FOOTER_HEIGHT + 20, left: 50, right: 50 };

/**
 * The banner every page gets — logo + report title on a charcoal-to-grey
 * gradient bar, per the brand manual's own letterhead example (Section 4).
 * Registered once against 'pageAdded' so it's redrawn automatically on
 * every page pdfkit creates, including ones it adds itself when content
 * overflows a page — not just the ones this file calls addPage() for.
 */
export function drawBanner(doc: Doc, logo: Buffer, title: string) {
  const width = doc.page.width;
  const gradient = doc.linearGradient(0, 0, width, 0);
  gradient.stop(0, BRAND.charcoal).stop(0.6, BRAND.charcoal).stop(1, BRAND.paleGrey);
  doc.rect(0, 0, width, BANNER_HEIGHT).fill(gradient);

  doc.image(logo, PAGE_MARGINS.left, 14, { height: 34 });

  doc
    .fillColor(BRAND.white)
    .font("Helvetica-Bold")
    .fontSize(15)
    .text(title, 0, 24, { align: "right", width: width - PAGE_MARGINS.right });

  // pdfkit's .text() moves the x/y cursor to just past what it drew, even
  // with explicit coordinates — left alone, the very next content call
  // would start from wherever the banner's own title text left off (partway
  // through the banner itself), not from below it. Every page's content
  // needs to start at the same place regardless of what the banner drew.
  doc.fillColor("black").font("Helvetica");
  doc.x = PAGE_MARGINS.left;
  doc.y = PAGE_MARGINS.top;
}

/** A full-width charcoal-to-grey section header bar, e.g. "JOB DETAILS" — mirrors the banner's gradient at a smaller scale. Advances doc.y past it. */
export function drawSectionBar(doc: Doc, label: string) {
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const y = doc.y;
  const height = 20;

  const gradient = doc.linearGradient(x, y, x + width, y);
  gradient.stop(0, BRAND.charcoal).stop(1, BRAND.paleGrey);
  doc.rect(x, y, width, height).fill(gradient);

  doc
    .fillColor(BRAND.white)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(label.toUpperCase(), x + 8, y + 6, { lineBreak: false });

  // Reset x too, not just y — every content call after this one passes its
  // own explicit x, but leaving doc.x wherever the bar's own label text
  // landed would corrupt any later call (e.g. the hash manifest listing)
  // that draws text without an explicit x of its own.
  doc.fillColor("black").font("Helvetica");
  doc.x = x;
  doc.y = y + height + 10;
}

/**
 * One or two label/value pairs on the same line, e.g. "Scheduled Start:
 * 24/08/2026" beside "Actual End: 24/08/2026 11:51". Fixed row height
 * (16pt) and `lineBreak: false` — every value here is a short, predictable
 * string (a date, a name, a code), so truncation risk is low and this
 * avoids the two columns needing independent height tracking when one
 * value wraps and the other doesn't. Long free text (descriptions, notes)
 * goes through fieldBlock below instead, not this.
 */
export function twoColumnRow(
  doc: Doc,
  left: [string, string | null | undefined],
  right?: [string, string | null | undefined],
) {
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colWidth = width / 2;
  const labelWidth = 100;
  const y = doc.y;

  doc.font("Helvetica-Bold").fontSize(9).fillColor(BRAND.charcoal);
  doc.text(left[0], x, y, { width: labelWidth, lineBreak: false });
  doc.font("Helvetica").fillColor(BRAND.digitalPink);
  doc.text(left[1] || "—", x + labelWidth, y, { width: colWidth - labelWidth - 10, lineBreak: false });

  if (right) {
    const rightX = x + colWidth;
    doc.font("Helvetica-Bold").fillColor(BRAND.charcoal);
    doc.text(right[0], rightX, y, { width: labelWidth, lineBreak: false });
    doc.font("Helvetica").fillColor(BRAND.digitalPink);
    doc.text(right[1] || "—", rightX + labelWidth, y, { width: colWidth - labelWidth - 10, lineBreak: false });
  }

  doc.fillColor("black").font("Helvetica");
  doc.y = y + 16;
}

/** A label on its own line, with wrapped body text beneath — for anything too long to trust to twoColumnRow's fixed row height (descriptions, notes, issue text). */
export function labelledParagraph(doc: Doc, label: string, value: string | null | undefined) {
  if (!value) return;
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.font("Helvetica-Bold").fontSize(9).fillColor(BRAND.charcoal).text(label, x, doc.y, { width });
  doc.font("Helvetica").fillColor("black").text(value, x, doc.y, { width });
  doc.moveDown(0.5);
}

/**
 * The site location map beneath the Address line — a grid of the fetched
 * OpenStreetMap tiles (site-map.ts's buildSiteMapPlan) clipped to a box and
 * a pin marker drawn at the site's exact pixel position within it. Includes
 * the "© OpenStreetMap contributors" attribution OSM's tile usage policy
 * requires wherever their tiles are displayed — the same text
 * `components/site-map.tsx`'s Leaflet map already shows in-app.
 */
export function drawSiteMap(doc: Doc, x: number, y: number, width: number, height: number, plan: SiteMapPlan) {
  const scale = width / plan.windowWidthPx;

  doc.save();
  doc.rect(x, y, width, height).clip();
  for (const tile of plan.tiles) {
    const tileX = x + (tile.x * TILE_SIZE - plan.windowLeftPx) * scale;
    const tileY = y + (tile.y * TILE_SIZE - plan.windowTopPx) * scale;
    const tileSize = TILE_SIZE * scale;
    doc.image(tile.bytes, tileX, tileY, { width: tileSize, height: tileSize });
  }
  doc.restore();

  const markerX = x + plan.markerPx.x * scale;
  const markerY = y + plan.markerPx.y * scale;
  doc.circle(markerX, markerY, 6).fillColor(BRAND.digitalPink).fill();
  doc.circle(markerX, markerY, 6).strokeColor(BRAND.white).lineWidth(1.5).stroke();

  doc.rect(x, y, width, height).strokeColor(BRAND.paleGrey).lineWidth(1).stroke();

  doc
    .fontSize(6)
    .fillColor(BRAND.charcoal)
    .text("© OpenStreetMap contributors", x + width - 150, y + height - 12, { width: 148, align: "right", lineBreak: false });

  // Same lesson as drawBanner/drawSectionBar/drawFooters (see their own
  // comments): pdfkit's .image()/.text() calls leave doc.x/doc.y wherever
  // their own content happened to land — here, wherever the last tile
  // image's own (unclipped) bottom edge fell, which can be well past the
  // visible box since edge tiles are drawn at full size and only clipped
  // visually. Left alone, the very next content call would start from
  // that stray position instead of just below the map box.
  doc.fillColor("black").font("Helvetica");
  doc.x = x;
  doc.y = y + height;
}

/**
 * One "Form Details"/"Issues" entry — a coloured field name, a thin rule,
 * then its value — the same shape as the reference layout's individual RFI
 * blocks (field name as a small heading, its answer beneath), just backed
 * by this app's own form fields/issues instead of AppSheet's RFI ids.
 */
export function fieldBlock(doc: Doc, label: string, value: string, accent: string = BRAND.digitalPink) {
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  // Manual page-break check rather than relying on pdfkit's own
  // overflow-triggered addPage(): that only kicks in per individual
  // .text() call, which could split a block right after its label/rule,
  // stranding the value alone at the top of the next page.
  doc.font("Helvetica").fontSize(9);
  const estimatedHeight = 20 + doc.heightOfString(value, { width }) + 14;
  if (doc.y + estimatedHeight > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }

  doc.font("Helvetica-Bold").fontSize(11).fillColor(accent).text(label, x, doc.y, { width });
  const ruleY = doc.y + 2;
  doc.moveTo(x, ruleY).lineTo(x + width, ruleY).strokeColor(BRAND.paleGrey).lineWidth(1).stroke();
  doc.y = ruleY + 6;

  doc.font("Helvetica").fontSize(9).fillColor("black").text(value, x, doc.y, { width });
  doc.moveDown(0.8);
}

const PHOTO_BOX_WIDTH = 150;
const PHOTO_BOX_HEIGHT = 110;

/**
 * A "Photos" entry — label + capture caption on the left, the actual
 * thumbnail (or a placeholder for a video, which pdfkit can't embed as an
 * image) on the right, so a reader sees the photo next to what it's a
 * photo of rather than flipping to a separate photos-only page for every
 * single one, per the reference report layout's "Image Bank" RFI blocks.
 */
export function photoBlock(
  doc: Doc,
  label: string,
  caption: string,
  image: { bytes: Buffer; isVideo: false } | { bytes: null; isVideo: true },
) {
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const textWidth = width - PHOTO_BOX_WIDTH - 12;
  const blockHeight = PHOTO_BOX_HEIGHT + 10;

  if (doc.y + blockHeight > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }

  const startY = doc.y;
  doc.font("Helvetica-Bold").fontSize(11).fillColor(BRAND.digitalPink).text(label, x, startY, { width: textWidth });
  const ruleY = doc.y + 2;
  doc.moveTo(x, ruleY).lineTo(x + textWidth, ruleY).strokeColor(BRAND.paleGrey).lineWidth(1).stroke();
  doc.font("Helvetica").fontSize(8).fillColor(BRAND.charcoal).text(caption, x, ruleY + 6, { width: textWidth });

  const imgX = x + textWidth + 12;
  if (image.isVideo) {
    doc.rect(imgX, startY, PHOTO_BOX_WIDTH, PHOTO_BOX_HEIGHT).strokeColor(BRAND.paleGrey).lineWidth(1).stroke();
    doc
      .fontSize(8)
      .fillColor(BRAND.charcoal)
      .text("Video captured — see the job record for playback.", imgX + 8, startY + PHOTO_BOX_HEIGHT / 2 - 12, {
        width: PHOTO_BOX_WIDTH - 16,
      });
  } else {
    doc.image(image.bytes, imgX, startY, { fit: [PHOTO_BOX_WIDTH, PHOTO_BOX_HEIGHT] });
  }

  doc.fillColor("black").font("Helvetica");
  doc.y = startY + blockHeight;
}

/** The Completion section's signature box — dashed border (per the reference layout), with the actual signature drawn inside once captured, or left empty as a visible "not yet signed" cue rather than silently omitted. */
export function drawSignatureBox(doc: Doc, x: number, y: number, width: number, height: number, image: Buffer | null) {
  doc.dash(3, { space: 2 }).rect(x, y, width, height).strokeColor(BRAND.charcoal).lineWidth(1).stroke();
  doc.undash();
  if (image) {
    doc.image(image, x + 4, y + 4, { fit: [width - 8, height - 8] });
  } else {
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(BRAND.charcoal)
      .text("Not yet signed", x, y + height / 2 - 4, { width, align: "center" });
  }
  doc.fillColor("black");
}

/** A thin charcoal rule + "Page X of Y", drawn once at the very end via bufferedPageRange — the total page count isn't known until every page has already been generated. */
export function drawFooters(doc: Doc) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const width = doc.page.width;
    const y = doc.page.height - FOOTER_HEIGHT;

    // The footer lives inside the bottom margin on purpose (that's the
    // space PAGE_MARGINS.bottom reserves for it) — but pdfkit's .text()
    // still checks the target y against the page's *printable* area
    // (height minus margins.bottom) even with explicit coordinates, and
    // silently starts a brand new page when it thinks the text doesn't
    // fit. Zeroing the bottom margin for the duration of this one write
    // is the standard workaround; nothing else runs against this page
    // afterward, so there's nothing else for the margin to protect here.
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    doc.moveTo(PAGE_MARGINS.left, y).lineTo(width - PAGE_MARGINS.right, y).strokeColor(BRAND.charcoal).lineWidth(1).stroke();
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(BRAND.charcoal)
      .text(`Page ${i - range.start + 1} of ${range.count}`, 0, y + 6, {
        align: "right",
        width: width - PAGE_MARGINS.right,
        lineBreak: false,
      });

    doc.page.margins.bottom = bottomMargin;
  }
}
