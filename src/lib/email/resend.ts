import "server-only";
import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { buildEmailHeaders, type EmailHeaders } from "./threading";
import type { EmailContent } from "./templates";

// Callers pass either the request-scoped SSR client (office server actions)
// or the service-role admin client (the webhook route, which has no user
// session) — both satisfy this shape, so it's typed structurally rather
// than tied to one specific factory.
type AnySupabaseClient = SupabaseClient<Database>;

/**
 * Returns null (not a thrown error) when RESEND_API_KEY isn't set, so
 * "job assigned"/"submitted"/etc. callers can treat sending as best-effort —
 * exactly the same non-blocking contract as Calendar sync (see
 * sync-job-calendar.ts), and for the same reason: an unconfigured
 * integration in this sandbox must not stop a job being assigned, submitted,
 * or approved.
 */
function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

export type SendResult = { status: "sent" | "skipped"; messageId: string | null };

/**
 * Sends one email about a job, threading it via `buildEmailHeaders`: the
 * first email for a job becomes the thread root and that root id is
 * persisted to `jobs.email_thread_id`; every later email references it.
 * "First for this job" is read from the job row itself (email_thread_id
 * null or not) rather than tracked separately, so it can't drift out of
 * sync with what's actually been sent.
 */
export async function sendJobEmail(
  supabase: AnySupabaseClient,
  jobId: string,
  to: string,
  content: EmailContent,
): Promise<SendResult> {
  const resend = getResendClient();
  if (!resend) return { status: "skipped", messageId: null };

  const { data: job } = await supabase.from("jobs").select("email_thread_id").eq("id", jobId).single();
  const isFirst = !job?.email_thread_id;
  const headers = buildEmailHeaders(jobId, isFirst, crypto.randomUUID());

  await sendWithHeaders(resend, to, content, headers);

  if (isFirst) {
    await supabase.from("jobs").update({ email_thread_id: headers.messageId }).eq("id", jobId);
  }

  return { status: "sent", messageId: headers.messageId };
}

/** Weekly summaries aren't about one job, so there's no thread to join — sent as a standalone message. */
export async function sendStandaloneEmail(to: string, content: EmailContent): Promise<SendResult> {
  const resend = getResendClient();
  if (!resend) return { status: "skipped", messageId: null };

  const { data, error } = await resend.emails.send({
    from: fromAddress(),
    to,
    subject: content.subject,
    html: content.html,
    text: content.text,
  });
  if (error) throw new Error(`Resend send failed: ${error.message}`);
  return { status: "sent", messageId: data?.id ?? null };
}

async function sendWithHeaders(resend: Resend, to: string, content: EmailContent, headers: EmailHeaders) {
  const emailHeaders: Record<string, string> = { "Message-ID": headers.messageId };
  if (headers.references) emailHeaders["References"] = headers.references;
  if (headers.inReplyTo) emailHeaders["In-Reply-To"] = headers.inReplyTo;

  const { error } = await resend.emails.send({
    from: fromAddress(),
    to,
    subject: content.subject,
    html: content.html,
    text: content.text,
    headers: emailHeaders,
  });
  if (error) throw new Error(`Resend send failed: ${error.message}`);
}

function fromAddress(): string {
  return process.env.RESEND_FROM_EMAIL || "UXG Engineer Job Scheduler <notifications@uxgengineering.example.com>";
}
