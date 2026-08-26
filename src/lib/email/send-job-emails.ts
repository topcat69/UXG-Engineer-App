import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { appBaseUrl } from "@/lib/app-url";
import { humanize } from "@/lib/format/text";
import { JOB_TYPE_LABELS } from "@/lib/forms/job-form";
import { downloadBytes } from "@/lib/pdf/completion-report";
import { sendJobEmail, sendStandaloneEmail, type EmailAttachment, type SendResult } from "./resend";
import {
  buildApprovedEmail,
  buildAssignedEmail,
  buildCancelledEmail,
  buildDayBeforeEmail,
  buildScheduledEmail,
  buildSubmittedEmail,
  buildWeeklySummaryEmail,
} from "./templates";

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

/** "Job cancelled" — sent to the assigned engineer; the Calendar event removal is a separate best-effort call at the same call site (see cancelJob in office/jobs/[id]/actions.ts). */
export async function sendJobCancelledEmail(supabase: AnySupabaseClient, jobId: string, reason: string | null): Promise<SendResult> {
  const { data: job } = await supabase
    .from("jobs")
    .select("job_number, scheduled_start, site:sites(name), assigned:users!jobs_assigned_to_fkey(name, email)")
    .eq("id", jobId)
    .single();
  if (!job?.site || !job.assigned?.email) return SKIPPED;

  const content = buildCancelledEmail({
    jobNumber: job.job_number,
    siteName: job.site.name,
    scheduledStart: job.scheduled_start,
    engineerName: job.assigned.name,
    reason,
    deepLink: `${appBaseUrl()}/office/jobs/${jobId}`,
  });
  return sendJobEmail(supabase, jobId, job.assigned.email, content);
}

function attachmentFilename(kind: "RAMS" | "Site-plan", storagePath: string): string {
  const ext = storagePath.split(".").pop();
  return ext ? `${kind}.${ext}` : kind;
}

/**
 * "New Job Scheduled" — sent every time a job's schedule is set or changed
 * for its assigned engineer, including reschedules (a job dragged to a new
 * day is a real change to what the engineer needs to know, not noise) —
 * see the call sites in office/jobs/[id]/actions.ts, office/scheduler/actions.ts,
 * and office/jobs/actions.ts's bulkScheduleJobs. Carries the same full job
 * detail set as the Calendar event body (lib/google/event-payload.ts) plus
 * whichever of RAMS/site plan are on file, downloaded from Storage and
 * attached directly rather than just linked, per spec.
 */
export async function sendJobScheduledEmail(supabase: AnySupabaseClient, jobId: string): Promise<SendResult> {
  const { data: job } = await supabase
    .from("jobs")
    .select(
      "job_number, scheduled_start, scheduled_end, description, job_type, status, assigned:users!jobs_assigned_to_fkey(name, email), job_details(job_information, sla_requirement_detail, rams_storage_path, site_plan_storage_path), job_equipment(model, serial), site:sites(name, address_line1, address_line2, town, postcode, access_notes, contact_name, contact_phone, client:clients(name))",
    )
    .eq("id", jobId)
    .single();
  if (!job?.site || !job.assigned?.email || !job.scheduled_start) return SKIPPED;

  const attachments: EmailAttachment[] = [];
  const ramsPath = job.job_details?.rams_storage_path;
  const sitePlanPath = job.job_details?.site_plan_storage_path;
  if (ramsPath) {
    const bytes = await downloadBytes(supabase, ramsPath);
    if (bytes) attachments.push({ filename: attachmentFilename("RAMS", ramsPath), content: bytes });
  }
  if (sitePlanPath) {
    const bytes = await downloadBytes(supabase, sitePlanPath);
    if (bytes) attachments.push({ filename: attachmentFilename("Site-plan", sitePlanPath), content: bytes });
  }

  const siteAddress = [job.site.address_line1, job.site.address_line2, job.site.town, job.site.postcode]
    .filter(Boolean)
    .join(", ");

  const content = buildScheduledEmail(
    {
      jobNumber: job.job_number,
      clientName: job.site.client?.name ?? null,
      siteName: job.site.name,
      siteAddress,
      scheduledStart: job.scheduled_start,
      scheduledEnd: job.scheduled_end,
      engineerName: job.assigned.name,
      jobType: JOB_TYPE_LABELS[job.job_type as keyof typeof JOB_TYPE_LABELS] ?? humanize(job.job_type),
      status: job.status,
      description: job.description,
      jobInformation: job.job_details?.job_information ?? null,
      slaRequirementDetail: job.job_details?.sla_requirement_detail ?? null,
      equipment: job.job_equipment ?? [],
      accessNotes: job.site.access_notes,
      siteContactName: job.site.contact_name,
      siteContactPhone: job.site.contact_phone,
      deepLink: `${appBaseUrl()}/office/jobs/${jobId}`,
    },
    attachments.map((a) => a.filename),
  );

  return sendJobEmail(supabase, jobId, job.assigned.email, content, attachments);
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
 * fans this out to every active manager/superadmin.
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
// A week is long enough for a recipient to actually open the email without
// the link being live indefinitely — completion_pdf_url is a private-bucket
// storage path, not a URL, so every reader (this email, the share page)
// signs its own fresh link rather than one being generated once and reused.
const PDF_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

export async function sendApprovedEmail(supabase: AnySupabaseClient, jobId: string, clientEmail: string, clientName: string): Promise<SendResult> {
  const { data: job } = await supabase
    .from("jobs")
    .select("job_number, completion_pdf_url, site:sites(name)")
    .eq("id", jobId)
    .single();
  if (!job?.site) return SKIPPED;

  let pdfUrl: string | null = null;
  if (job.completion_pdf_url) {
    const { data } = await supabase.storage.from("media").createSignedUrl(job.completion_pdf_url, PDF_SIGNED_URL_TTL_SECONDS);
    pdfUrl = data?.signedUrl ?? null;
  }

  const content = buildApprovedEmail({
    jobNumber: job.job_number,
    siteName: job.site.name,
    clientName,
    deepLink: `${appBaseUrl()}/office/jobs/${jobId}`,
    pdfUrl,
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
