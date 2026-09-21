import "server-only";
import JSZip from "jszip";

/** Bundles one report's three other export formats into a single download, per the confirmed scoping decision — these aggregate reports have no photos/originals to bundle (unlike the per-job zip in job-archive.ts), so "zip" here just means "everything in one click." */
export async function bundleReportFormats(baseName: string, pdf: Buffer, xlsx: Buffer, csv: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(`${baseName}.pdf`, pdf);
  zip.file(`${baseName}.xlsx`, xlsx);
  zip.file(`${baseName}.csv`, csv);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
