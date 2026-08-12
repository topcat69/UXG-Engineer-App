import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { generateCompletionReport } from "@/lib/pdf/completion-report";

/**
 * On-demand report pull for /office/reports — deliberately separate from
 * `jobs.completion_pdf_url` (set only at QA approval, see qa/actions.ts):
 * a superadmin/manager can pull a job's report at any point in its
 * lifecycle, generated fresh from current data rather than a possibly
 * stale or (for a not-yet-approved job) nonexistent stored copy.
 *
 * /api is public at the proxy layer (see proxy.ts's PUBLIC_PATHS), so this
 * route checks the session and role itself rather than relying on the
 * /office layout's redirect, which never runs for a direct API request.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (user.role !== "superadmin" && user.role !== "manager") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await createClient();
  const { data: job } = await supabase.from("jobs").select("job_number").eq("id", id).single();
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const pdf = await generateCompletionReport(supabase, id);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${job.job_number}-report.pdf"`,
    },
  });
}
