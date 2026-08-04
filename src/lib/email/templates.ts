export type EmailContent = { subject: string; html: string; text: string };

function wrap(paragraphs: string[]): { html: string; text: string } {
  return {
    html: paragraphs.map((p) => `<p>${p}</p>`).join("\n"),
    text: paragraphs.join("\n\n"),
  };
}

export type AssignedEmailInput = {
  jobNumber: string;
  siteName: string;
  /** Assignment can happen before scheduling (Phase 2's assign-then-schedule workflow) — null when not yet scheduled. */
  scheduledStart: string | null;
  engineerName: string;
  deepLink: string;
};

export function buildAssignedEmail(input: AssignedEmailInput): EmailContent {
  const when = input.scheduledStart
    ? new Date(input.scheduledStart).toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short" })
    : null;
  const { html, text } = wrap([
    `Hi ${input.engineerName},`,
    when
      ? `You've been assigned job ${input.jobNumber} at ${input.siteName}, scheduled for ${when}.`
      : `You've been assigned job ${input.jobNumber} at ${input.siteName}. It isn't scheduled yet — you'll get another email once it is.`,
    `Job details: ${input.deepLink}`,
  ]);
  return { subject: `${input.jobNumber} — ${input.siteName} — assigned to you`, html, text };
}

export type DayBeforeEmailInput = {
  jobNumber: string;
  siteName: string;
  scheduledStart: string;
  engineerName: string;
  deepLink: string;
};

export function buildDayBeforeEmail(input: DayBeforeEmailInput): EmailContent {
  const when = new Date(input.scheduledStart).toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short" });
  const { html, text } = wrap([
    `Hi ${input.engineerName},`,
    `Reminder: job ${input.jobNumber} at ${input.siteName} is scheduled for tomorrow, ${when}.`,
    `Job details: ${input.deepLink}`,
  ]);
  return { subject: `${input.jobNumber} — ${input.siteName} — scheduled for tomorrow`, html, text };
}

export type SubmittedEmailInput = {
  jobNumber: string;
  siteName: string;
  engineerName: string;
  managerName: string;
  deepLink: string;
};

export function buildSubmittedEmail(input: SubmittedEmailInput): EmailContent {
  const { html, text } = wrap([
    `Hi ${input.managerName},`,
    `${input.engineerName} has submitted job ${input.jobNumber} at ${input.siteName}. It's now in your QA queue.`,
    `Review it: ${input.deepLink}`,
  ]);
  return { subject: `${input.jobNumber} — ${input.siteName} — submitted for QA`, html, text };
}

export type ApprovedEmailInput = {
  jobNumber: string;
  siteName: string;
  clientName: string;
  deepLink: string;
  /** Null until Phase 5 builds the completion PDF — the email still sends, just without a report link yet. */
  pdfUrl: string | null;
};

export function buildApprovedEmail(input: ApprovedEmailInput): EmailContent {
  const { html, text } = wrap([
    `Hi ${input.clientName},`,
    `Job ${input.jobNumber} at ${input.siteName} has been completed and approved.`,
    input.pdfUrl
      ? `Your completion report: ${input.pdfUrl}`
      : "Your completion report is being finalised and will follow separately.",
    `View job status: ${input.deepLink}`,
  ]);
  return { subject: `${input.jobNumber} — ${input.siteName} — completed`, html, text };
}

export type WeeklySummaryEmailInput = {
  projectName: string;
  weekLabel: string;
  completedCount: number;
  scheduledCount: number;
  openIssueCount: number;
  deepLink: string;
};

export function buildWeeklySummaryEmail(input: WeeklySummaryEmailInput): EmailContent {
  const { html, text } = wrap([
    `Weekly summary for ${input.projectName}, ${input.weekLabel}:`,
    `${input.completedCount} job(s) completed, ${input.scheduledCount} scheduled, ${input.openIssueCount} open issue(s).`,
    `Full project view: ${input.deepLink}`,
  ]);
  return { subject: `${input.projectName} — weekly summary — ${input.weekLabel}`, html, text };
}
