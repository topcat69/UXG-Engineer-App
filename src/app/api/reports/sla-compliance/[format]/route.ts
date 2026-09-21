import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { fetchSlaComplianceReportData, type SlaComplianceFilters, type GroupBy } from "@/lib/reports/sla-compliance-data";
import { generateSlaComplianceReportPdf } from "@/lib/pdf/sla-compliance-report";
import { slaComplianceToXlsx } from "@/lib/xlsx/export";
import { slaComplianceToCsv } from "@/lib/csv/export";
import { bundleReportFormats } from "@/lib/reports/report-zip";

const FORMATS = ["pdf", "xlsx", "csv", "zip"] as const;
type Format = (typeof FORMATS)[number];

function isoDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * One route, four export formats — /office/reports/sla-compliance's own
 * "Export this view" links all point here with the same querystring the
 * page itself was rendered with, so an export always matches what's on
 * screen (same guarantee /api/export/jobs documents for the jobs list).
 * All four formats run fetchSlaComplianceReportData exactly once and
 * format its result differently, rather than each format re-querying —
 * see that function's own comment on why the query is shared.
 *
 * /api is public at the proxy layer (see proxy.ts's PUBLIC_PATHS), so
 * this route checks the session/role itself, same as
 * /api/jobs/[id]/report/pdf.
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
  const today = new Date();
  const filters: SlaComplianceFilters = {
    dateFrom: sp.get("date_from") || isoDateOnly(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)),
    dateTo: sp.get("date_to") || isoDateOnly(today),
    clientId: sp.get("client_id") ?? "",
    siteId: sp.get("site_id") ?? "",
    fixtureTypeId: sp.get("fixture_type_id") ?? "",
    reasonId: sp.get("reason_id") ?? "",
    assignedTo: sp.get("assigned_to") ?? "",
    projectId: sp.get("project_id") ?? "",
    groupBy: (sp.get("group_by") || "fixture_type") as GroupBy,
  };

  const supabase = await createClient();
  const result = await fetchSlaComplianceReportData(supabase, filters);
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 500 });

  const filename = `sla-compliance-${filters.dateFrom}-to-${filters.dateTo}`;

  if (format === "csv") {
    return new NextResponse(slaComplianceToCsv(result.data.rows), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}.csv"` },
    });
  }
  if (format === "xlsx") {
    const xlsx = await slaComplianceToXlsx(result.data);
    return new NextResponse(new Uint8Array(xlsx), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
      },
    });
  }
  if (format === "pdf") {
    const pdf = await generateSlaComplianceReportPdf(result.data);
    return new NextResponse(new Uint8Array(pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}.pdf"` },
    });
  }

  // zip
  const [pdf, xlsx] = await Promise.all([generateSlaComplianceReportPdf(result.data), slaComplianceToXlsx(result.data)]);
  const csv = slaComplianceToCsv(result.data.rows);
  const zip = await bundleReportFormats(filename, pdf, xlsx, csv);
  return new NextResponse(new Uint8Array(zip), {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${filename}.zip"` },
  });
}
