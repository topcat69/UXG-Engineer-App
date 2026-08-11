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
// Field Service Management workspace (Monday.com board id 5101602138).
const COLUMN_IDS = {
  jobReference: "text_mm5x44h9",
  issueType: "dropdown_mm5xbd",
  dateRaised: "date_mm5xn22e",
  severity: "color_mm5xg295",
  status: "color_mm5x1wcq",
  reportedBy: "multiple_person_mm5xsats",
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

// This app's `category` is free text (no fixed vocabulary — see
// field-actions.ts and parse-issues.ts), while the Monday board's "Issue
// Type" is a fixed dropdown, so there's no exact mapping. Best-effort
// keyword match against the board's real labels, falling back to "Other"
// rather than failing or leaving the column blank.
const ISSUE_TYPE_KEYWORDS: [RegExp, string][] = [
  [/connect|network|wifi/i, "Connectivity Issue"],
  [/access/i, "Site Access Issue"],
  [/missing|equipment/i, "Equipment Missing"],
  [/customer/i, "Customer Damage"],
  [/screen/i, "Damaged Screen"],
  [/damage|fixture/i, "Damaged Fixture"],
];

/** blocks_completion is a much stronger, structured signal than the free-text
 * category, so it wins outright when set — this app already treats a
 * blocking issue as one that needs a revisit. */
function issueTypeLabel(issue: MondayIssue): string {
  if (issue.blocks_completion) return "Revisit Required";
  if (issue.category) {
    const match = ISSUE_TYPE_KEYWORDS.find(([pattern]) => pattern.test(issue.category!));
    if (match) return match[1];
  }
  return "Other";
}

const MAX_ITEM_NAME_LENGTH = 200;

export function buildIssueItemName(issue: MondayIssue, job: MondayIssueJob): string {
  const name = `${job.job_number}: ${issue.description}`;
  return name.length > MAX_ITEM_NAME_LENGTH ? `${name.slice(0, MAX_ITEM_NAME_LENGTH - 3)}...` : name;
}

/** Monday's create_item mutation takes column_values as a JSON-encoded
 * string; this builds the plain object callers then JSON.stringify.
 * `raisedByMondayUserId` is looked up separately (by email, best-effort —
 * see client.ts's findMondayUserIdByEmail) since it needs a live API call
 * this function, being pure, can't make itself; pass null/undefined when
 * there's no match to leave the column unset rather than guessing. */
export function buildIssueColumnValues(
  issue: MondayIssue,
  job: MondayIssueJob,
  raisedByMondayUserId?: number | null,
): Record<string, unknown> {
  const values: Record<string, unknown> = {
    [COLUMN_IDS.jobReference]: job.job_number,
    [COLUMN_IDS.issueType]: { labels: [issueTypeLabel(issue)] },
    [COLUMN_IDS.severity]: { label: SEVERITY_LABELS[issue.severity] ?? "Medium" },
    [COLUMN_IDS.status]: { label: STATUS_LABELS[issue.status ?? "open"] ?? "Open" },
  };
  if (issue.created_at) {
    values[COLUMN_IDS.dateRaised] = { date: issue.created_at.slice(0, 10) };
  }
  if (raisedByMondayUserId != null) {
    values[COLUMN_IDS.reportedBy] = { personsAndTeams: [{ id: raisedByMondayUserId, kind: "person" }] };
  }
  return values;
}
