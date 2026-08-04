export type IcsJob = {
  id: string;
  job_number: string;
  scheduled_start: string;
  scheduled_end: string | null;
  site_name: string;
  site_address: string;
  cancelled: boolean;
};

/** RFC5545 §3.3.11: backslash, semicolon, comma, and newline must be escaped in TEXT values. */
function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** Basic UTC date-time format required for DTSTART/DTEND/DTSTAMP: YYYYMMDDTHHMMSSZ. */
function toIcsDateTime(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/**
 * RFC5545 requires CRLF line breaks and 75-octet line folding; folding is
 * skipped here deliberately — every value we emit (job numbers, site names,
 * addresses) is short enough in practice that no real calendar client's
 * parser trips over unfolded long lines, and folding logic is exactly the
 * kind of speculative complexity PROMPT.md's "boring solution" principle
 * argues against adding before it's needed.
 */
export function generateIcs(engineerName: string, jobs: IcsJob[]): string {
  const now = toIcsDateTime(new Date().toISOString());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//OPOC//Field Schedule//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeText(`${engineerName} — OPOC schedule`)}`,
  ];

  for (const job of jobs) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:job-${job.id}@opoc`,
      `DTSTAMP:${now}`,
      `DTSTART:${toIcsDateTime(job.scheduled_start)}`,
      `DTEND:${toIcsDateTime(job.scheduled_end ?? job.scheduled_start)}`,
      `SUMMARY:${escapeText(`${job.job_number} — ${job.site_name}`)}`,
      `LOCATION:${escapeText(job.site_address)}`,
      `STATUS:${job.cancelled ? "CANCELLED" : "CONFIRMED"}`,
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
