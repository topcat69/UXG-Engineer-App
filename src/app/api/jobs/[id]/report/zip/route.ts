import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { generateJobArchive } from "@/lib/pdf/job-archive";

/** Same auth shape as the sibling pdf route — see its comment for why this checks the session itself. */
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

  const zip = await generateJobArchive(supabase, id);
  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${job.job_number}-archive.zip"`,
    },
  });
}
