import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyIcsToken } from "@/lib/ics/sign";
import { generateIcs, type IcsJob } from "@/lib/ics/feed";

/**
 * Public — deliberately outside Supabase auth (see proxy.ts's PUBLIC_PATHS)
 * since calendar apps subscribing to this URL have no session cookie.
 * Authenticity comes from the HMAC token instead; the admin client is safe
 * to use here because the token check already establishes "this caller is
 * allowed to see this one engineer's schedule" before any query runs.
 */
export async function GET(request: Request, { params }: { params: Promise<{ engineerId: string }> }) {
  const { engineerId } = await params;
  const token = new URL(request.url).searchParams.get("token");
  if (!token || !verifyIcsToken(engineerId, token)) {
    return NextResponse.json({ error: "Invalid or missing token" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data: engineer } = await supabase.from("users").select("name").eq("id", engineerId).single();
  if (!engineer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, job_number, status, scheduled_start, scheduled_end, site:sites(name, address_line1, address_line2, town, postcode)")
    .eq("assigned_to", engineerId)
    .not("scheduled_start", "is", null)
    .neq("status", "draft")
    .order("scheduled_start");

  const icsJobs: IcsJob[] = (jobs ?? [])
    .filter((job) => job.site)
    .map((job) => ({
      id: job.id,
      job_number: job.job_number,
      scheduled_start: job.scheduled_start!,
      scheduled_end: job.scheduled_end,
      site_name: job.site!.name,
      site_address: [job.site!.address_line1, job.site!.address_line2, job.site!.town, job.site!.postcode]
        .filter(Boolean)
        .join(", "),
      cancelled: job.status === "cancelled",
    }));

  const ics = generateIcs(engineer.name, icsJobs);
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${engineerId}.ics"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
