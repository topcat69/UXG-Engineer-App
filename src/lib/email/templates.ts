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

export type ScheduledEmailEquipmentItem = { model: string; serial: string | null };

/**
 * Everything about the job that's known at scheduling time — deliberately
 * the same field set as the Calendar event body (see
 * lib/google/event-payload.ts's buildEventPayload) since both exist to
 * answer "what is this job and where/when is it", just for different
 * surfaces (inbox vs calendar).
 */
export type ScheduledEmailInput = {
  jobNumber: string;
  clientName: string | null;
  siteName: string;
  siteAddress: string;
  scheduledStart: string;
  scheduledEnd: string | null;
  engineerName: string;
  jobType: string;
  priority: string | null;
  description: string | null;
  jobInformation: string | null;
  slaRequirementDetail: string | null;
  equipment: ScheduledEmailEquipmentItem[];
  accessNotes: string | null;
  siteContactName: string | null;
  siteContactPhone: string | null;
  deepLink: string;
};

function formatFullDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short" });
}

/**
 * "New Job Scheduled" — sent whenever a job gets a schedule (first time or
 * a change to one), so this fires on reschedules too, not just the initial
 * assignment. Attachments (RAMS/site plan) are handled by the caller via
 * sendJobEmail's attachments param — this builder only produces the text
 * that names them, since the actual files aren't known until the caller
 * has downloaded them from Storage.
 */
export function buildScheduledEmail(input: ScheduledEmailInput, attachedFilenames: string[]): EmailContent {
  const when =
    input.scheduledEnd && input.scheduledEnd.slice(0, 10) !== input.scheduledStart.slice(0, 10)
      ? `${formatFullDateTime(input.scheduledStart)} to ${formatFullDateTime(input.scheduledEnd)}`
      : formatFullDateTime(input.scheduledStart);

  const equipmentLine =
    input.equipment.length > 0
      ? `Equipment: ${input.equipment.map((e) => (e.serial ? `${e.model} (${e.serial})` : e.model)).join(", ")}`
      : null;

  const paragraphs = [
    `Hi ${input.engineerName},`,
    `You've been scheduled for job ${input.jobNumber} at ${input.siteName}, ${when}.`,
    input.clientName ? `Client: ${input.clientName}` : null,
    `Site: ${input.siteName} — ${input.siteAddress}`,
    `Job type: ${input.jobType}`,
    input.priority ? `Priority: ${input.priority}` : null,
    input.description ? `Job description: ${input.description}` : null,
    input.jobInformation ? `Job information: ${input.jobInformation}` : null,
    input.slaRequirementDetail ? `SLA requirement: ${input.slaRequirementDetail}` : null,
    equipmentLine,
    input.accessNotes ? `Access notes: ${input.accessNotes}` : null,
    input.siteContactName
      ? `Site contact: ${input.siteContactName}${input.siteContactPhone ? ` (${input.siteContactPhone})` : ""}`
      : null,
    attachedFilenames.length > 0 ? `Attached: ${attachedFilenames.join(", ")}` : null,
    `Job details: ${input.deepLink}`,
  ].filter((line): line is string => !!line);

  const { html, text } = wrap(paragraphs);
  return { subject: `New Job Scheduled — ${input.jobNumber}`, html, text };
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

export type CancelledEmailInput = {
  jobNumber: string;
  siteName: string;
  /** Cancellation isn't conditional on a job ever having been scheduled — an assigned-but-not-yet-scheduled job can be cancelled too. */
  scheduledStart: string | null;
  engineerName: string;
  /** The office's optional free-text reason from the cancel confirmation — see cancel-job-button.tsx. */
  reason: string | null;
  deepLink: string;
};

export function buildCancelledEmail(input: CancelledEmailInput): EmailContent {
  const when = input.scheduledStart
    ? new Date(input.scheduledStart).toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short" })
    : null;
  const { html, text } = wrap([
    `Hi ${input.engineerName},`,
    when
      ? `Job ${input.jobNumber} at ${input.siteName}, scheduled for ${when}, has been cancelled.`
      : `Job ${input.jobNumber} at ${input.siteName} has been cancelled.`,
    ...(input.reason ? [`Reason: ${input.reason}`] : []),
    `It's also been removed from your calendar.`,
    `Job details: ${input.deepLink}`,
  ]);
  return { subject: `${input.jobNumber} — ${input.siteName} — cancelled`, html, text };
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
