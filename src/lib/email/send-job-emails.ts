import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { appBaseUrl } from "@/lib/app-url";
import { sendJobEmail, sendStandaloneEmail, type SendResult } from "./resend";
import { buildApprovedEmail, buildAssignedEmail, buildDayBeforeEmail, buildSubmittedEmail, buildWeeklySummaryEmail } from "./templates";

// See resend.ts's AnySupabaseClient comment — callers pass either the SSR
// server client or the service-role admin client.
type AnySupabaseClient = SupabaseClient<Database>;

const SKIPPED: SendResult = { status: "skipped", messageId: null };

/** "Job assigned" — sent to the newly-assigned engineer once the job has a schedule to tell them about. */
export async function sendJobAssignedEmail(supabase: AnySupabaseClient, jobId: string): Promise<SendResult> {
  const { data: job } = await supabase
    .from("jobs")
    .select("job_number, scheduled_start, site:sites(name), assigned:users!jobs_assigned_to_fkey(name, email)")
    .eq("id", jobId)
    .single();
  if (!job?.site || !job.assigned?.email) return SKIPPED;

  const content = buildAssignedEmail({
    jobNumber: job.job_number,
    siteName: job.site.name,
    scheduledStart: job.scheduled_start,
    engineerName: job.assigned.name,
    deepLink: `${appBaseUrl()}/office/jobs/${jobId}`,
  });
  return sendJobEmail(supabase, jobId, job.assigned.email, content);
}

/** "Day-before schedule" reminder — see selection logic in src/lib/email/day-before.ts. */
export async function sendDayBeforeEmail(supabase: AnySupabaseClient, jobId: string): Promise<SendResult> {
  const { data: job } = await supabase
    .from("jobs")
    .select("job_number, scheduled_start, site:sites(name), assigned:users!jobs_assigned_to_fkey(name, email)")
    .eq("id", jobId)
    .single();
  if (!job?.site || !job.assigned?.email || !job.scheduled_start) return SKIPPED;

  const content = buildDayBeforeEmail({
    jobNumber: job.job_number,
    siteName: job.site.name,
    scheduledStart: job.scheduled_start,
    engineerName: job.assigned.name,
    deepLink: `${appBaseUrl()}/office/jobs/${jobId}`,
  });
  return sendJobEmail(supabase, jobId, job.assigned.email, content);
}

/**
 * "Submitted" (to manager) — deliberately takes an explicit `to` address
 * rather than looking up "the" manager, since there's no single designated
 * manager-per-job in the schema; the webhook route (the only caller today)
 * fans this out to every active manager/admin.
 */
export async function sendSubmittedEmail(supabase: AnySupabaseClient, jobId: string, to: string, managerName: string): Promise<SendResult> {
  const { data: job } = await supabase
    .from("jobs")
    .select("job_number, site:sites(name), assigned:users!jobs_assigned_to_fkey(name)")
    .eq("id", jobId)
    .single();
  if (!job?.site) return SKIPPED;

  const content = buildSubmittedEmail({
    jobNumber: job.job_number,
    siteName: job.site.name,
    engineerName: job.assigned?.name ?? "An engineer",
    managerName,
    deepLink: `${appBaseUrl()}/office/qa`,
  });
  return sendJobEmail(supabase, jobId, to, content);
}

/** "Approved" (to client) — completion_pdf_url is null until Phase 5 builds the report; the email still sends. */
export async function sendApprovedEmail(supabase: AnySupabaseClient, jobId: string, clientEmail: string, clientName: string): Promise<SendResult> {
  const { data: job } = await supabase
    .from("jobs")
    .select("job_number, completion_pdf_url, site:sites(name)")
    .eq("id", jobId)
    .single();
  if (!job?.site) return SKIPPED;

  const content = buildApprovedEmail({
    jobNumber: job.job_number,
    siteName: job.site.name,
    clientName,
    deepLink: `${appBaseUrl()}/office/jobs/${jobId}`,
    pdfUrl: job.completion_pdf_url,
  });
  return sendJobEmail(supabase, jobId, clientEmail, content);
}

export type WeeklySummaryStats = { completedCount: number; scheduledCount: number; openIssueCount: number };

/** Weekly project summary — not job-scoped, so it's a standalone send rather than threaded onto one job. */
export async function sendWeeklySummaryEmail(
  to: string,
  projectName: string,
  projectId: string,
  weekLabel: string,
  stats: WeeklySummaryStats,
): Promise<SendResult> {
  const content = buildWeeklySummaryEmail({
    projectName,
    weekLabel,
    ...stats,
    deepLink: `${appBaseUrl()}/office/jobs?project_id=${projectId}`,
  });
  return sendStandaloneEmail(to, content);
}
