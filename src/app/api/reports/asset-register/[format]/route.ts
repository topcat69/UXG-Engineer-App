import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { fetchAssetRegisterReportData, type AssetRegisterReportFilters } from "@/lib/reports/asset-register-data";
import { generateAssetRegisterReportPdf } from "@/lib/pdf/asset-register-report";
import { assetRegisterToXlsx } from "@/lib/xlsx/export";
import { assetRegisterToCsv } from "@/lib/csv/export";
import { bundleReportFormats } from "@/lib/reports/report-zip";

const FORMATS = ["pdf", "xlsx", "csv", "zip"] as const;
type Format = (typeof FORMATS)[number];

/**
 * One route, four export formats — see project-rollup's sibling route for
 * the full reasoning (same querystring the page renders with, one shared
 * query per request, role check here since /api is public at the proxy
 * layer). Unlike project-rollup, no scope is required — blank filters
 * export the whole register, same as the on-screen page.
 */
export async function GET(request: Request, { params }: { params: Promise<{ format: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (user.role !== "superadmin" && user.role !== "manager") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { format } = await params;
  if (!FORMATS.includes(format as Format)) {
    return NextResponse.json({ error: "Unknown export format" }, { status: 404 });
  }

  const sp = new URL(request.url).searchParams;
  const filters: AssetRegisterReportFilters = {
    clientId: sp.get("client_id") ?? "",
    siteId: sp.get("site_id") ?? "",
    categoryId: sp.get("category_id") ?? "",
    status: sp.get("status") ?? "",
  };

  const supabase = await createClient();
  const result = await fetchAssetRegisterReportData(supabase, filters);
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 500 });

  const filename = `asset-register-${new Date().toISOString().slice(0, 10)}`;

  if (format === "csv") {
    return new NextResponse(assetRegisterToCsv(result.data.rows), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}.csv"` },
    });
  }
  if (format === "xlsx") {
    const xlsx = await assetRegisterToXlsx(result.data);
    return new NextResponse(new Uint8Array(xlsx), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
      },
    });
  }
  if (format === "pdf") {
    const pdf = await generateAssetRegisterReportPdf(result.data);
    return new NextResponse(new Uint8Array(pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}.pdf"` },
    });
  }

  // zip
  const [pdf, xlsx] = await Promise.all([generateAssetRegisterReportPdf(result.data), assetRegisterToXlsx(result.data)]);
  const csv = assetRegisterToCsv(result.data.rows);
  const zip = await bundleReportFormats(filename, pdf, xlsx, csv);
  return new NextResponse(new Uint8Array(zip), {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${filename}.zip"` },
  });
}
