import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { fetchProjectRollupReportData, type ProjectRollupFilters, type GroupBy } from "@/lib/reports/project-rollup-data";
import { generateProjectRollupReportPdf } from "@/lib/pdf/project-rollup-report";
import { projectRollupToXlsx } from "@/lib/xlsx/export";
import { projectRollupToCsv } from "@/lib/csv/export";
import { bundleReportFormats } from "@/lib/reports/report-zip";

const FORMATS = ["pdf", "xlsx", "csv", "zip"] as const;
type Format = (typeof FORMATS)[number];

/**
 * One route, four export formats — see sla-compliance's sibling route for
 * the full reasoning (same querystring the page renders with, one shared
 * query per request, role check here since /api is public at the proxy
 * layer). Requires project_id and/or client_id, same as the page — with
 * neither set there's no scope to export, so this returns 400 rather
 * than a report over every job everywhere.
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
  const filters: ProjectRollupFilters = {
    projectId: sp.get("project_id") ?? "",
    clientId: sp.get("client_id") ?? "",
    status: sp.get("status") ?? "",
    jobType: sp.get("job_type") ?? "",
    siteId: sp.get("site_id") ?? "",
    assignedTo: sp.get("assigned_to") ?? "",
    dateFrom: sp.get("date_from") ?? "",
    dateTo: sp.get("date_to") ?? "",
    groupBy: (sp.get("group_by") || "status") as GroupBy,
  };

  if (!filters.projectId && !filters.clientId) {
    return NextResponse.json({ error: "Choose a customer and/or a project first." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: allProjects } = await supabase.from("projects").select("id, client_id");
  const result = await fetchProjectRollupReportData(supabase, filters, allProjects ?? []);
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 500 });
  if (!result.hasScope) return NextResponse.json({ error: "Choose a customer and/or a project first." }, { status: 400 });

  const filename = `project-rollup-${new Date().toISOString().slice(0, 10)}`;

  if (format === "csv") {
    return new NextResponse(projectRollupToCsv(result.data.rows), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}.csv"` },
    });
  }
  if (format === "xlsx") {
    const xlsx = await projectRollupToXlsx(result.data);
    return new NextResponse(new Uint8Array(xlsx), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
      },
    });
  }
  if (format === "pdf") {
    const pdf = await generateProjectRollupReportPdf(result.data);
    return new NextResponse(new Uint8Array(pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}.pdf"` },
    });
  }

  // zip
  const [pdf, xlsx] = await Promise.all([generateProjectRollupReportPdf(result.data), projectRollupToXlsx(result.data)]);
  const csv = projectRollupToCsv(result.data.rows);
  const zip = await bundleReportFormats(filename, pdf, xlsx, csv);
  return new NextResponse(new Uint8Array(zip), {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${filename}.zip"` },
  });
}
