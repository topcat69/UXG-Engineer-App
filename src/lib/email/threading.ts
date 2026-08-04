/**
 * Every email about a job threads off one stable, deterministic root
 * Message-ID derived from the job id — not the previous email sent, which
 * would need a DB round-trip and would break threading entirely if that
 * lookup ever missed. The root is computable from the job id alone, so
 * `email_thread_id` (persisted on first send) is a record of what was used
 * rather than the only way to reconstruct it.
 */
export function emailThreadRootId(jobId: string): string {
  return `<job-${jobId}@opoc.local>`;
}

export type EmailHeaders = {
  messageId: string;
  references?: string;
  inReplyTo?: string;
};

/**
 * The first email about a job *is* the thread root: its own Message-ID is
 * the root id, with no References/In-Reply-To. Every email after that gets
 * its own fresh Message-ID but references the root, which is what makes
 * mail clients group them into one thread.
 */
export function buildEmailHeaders(jobId: string, isFirstEmailForJob: boolean, freshId: string): EmailHeaders {
  const root = emailThreadRootId(jobId);
  if (isFirstEmailForJob) return { messageId: root };
  return { messageId: `<${freshId}@opoc.local>`, references: root, inReplyTo: root };
}
