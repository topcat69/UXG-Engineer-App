export type MondayIssue = {
  severity: string;
  category: string | null;
  description: string;
  blocks_completion: boolean | null;
  status: string | null;
  created_at: string | null;
};

export type MondayIssueJob = { job_number: string };

// This board's real column ids, from the "Issues" board under UX Global's
// CRM workspace (Monday.com board id 5102058078). Unlike the Field Service
// Management "Issues" board this app targeted before, this board has no
// Job Reference, Issue Type, or "reported by" people column — those go
// into the free-text Description column instead (see buildIssueDescription)
// rather than being dropped or forced into a column that doesn't fit.
const COLUMN_IDS = {
  status: "color_mm65tva9",
  severity: "dropdown_mm65mv1z",
  description: "text_mm65r8tx",
  reportedDate: "date_mm65dpd3",
};

const SEVERITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  resolved: "Resolved",
};

const MAX_ITEM_NAME_LENGTH = 200;

export function buildIssueItemName(issue: MondayIssue, job: MondayIssueJob): string {
  const name = `${job.job_number}: ${issue.description}`;
  return name.length > MAX_ITEM_NAME_LENGTH ? `${name.slice(0, MAX_ITEM_NAME_LENGTH - 3)}...` : name;
}

/** Everything this board has no dedicated column for — job number, who
 * reported it, the free-text category, whether it blocks completion — folded
 * into the Description text rather than lost. `reportedByName` is a plain
 * name, not a Monday user lookup: this board's only people column is
 * "Assignee", which means who owns fixing it, not who raised it, so
 * reusing it for the reporter would actively mislead whoever triages this
 * board. */
export function buildIssueDescription(
  issue: MondayIssue,
  job: MondayIssueJob,
  reportedByName?: string | null,
): string {
  const lines = [
    issue.description,
    "",
    `Job: ${job.job_number}`,
    reportedByName ? `Reported by: ${reportedByName}` : null,
    issue.category ? `Category: ${issue.category}` : null,
    issue.blocks_completion ? "Blocks completion: yes" : null,
  ];
  return lines.filter((line): line is string => line !== null).join("\n");
}

/** Monday's create_item mutation takes column_values as a JSON-encoded
 * string; this builds the plain object callers then JSON.stringify. */
export function buildIssueColumnValues(
  issue: MondayIssue,
  job: MondayIssueJob,
  reportedByName?: string | null,
): Record<string, unknown> {
  const values: Record<string, unknown> = {
    [COLUMN_IDS.description]: buildIssueDescription(issue, job, reportedByName),
    [COLUMN_IDS.severity]: { labels: [SEVERITY_LABELS[issue.severity] ?? "Medium"] },
    [COLUMN_IDS.status]: { label: STATUS_LABELS[issue.status ?? "open"] ?? "Open" },
  };
  if (issue.created_at) {
    values[COLUMN_IDS.reportedDate] = { date: issue.created_at.slice(0, 10) };
  }
  return values;
}
