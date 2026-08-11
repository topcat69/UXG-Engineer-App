import "server-only";

const MONDAY_API_URL = "https://api.monday.com/v2";

async function mondayRequest<T>(token: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(MONDAY_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: token },
    body: JSON.stringify({ query, variables }),
  });

  const body = (await response.json()) as { data?: T; errors?: unknown };
  if (!response.ok || body.errors || !body.data) {
    throw new Error(`Monday.com API call failed: ${JSON.stringify(body.errors ?? response.statusText)}`);
  }
  return body.data;
}

/**
 * Returns "skipped" (not a thrown error) when MONDAY_API_TOKEN or
 * MONDAY_ISSUES_BOARD_ID isn't set, so issue sync stays best-effort —
 * same non-blocking contract as Calendar sync and Resend email: an
 * unconfigured integration must never stop an issue being raised.
 */
export type MondayCreateItemResult = { status: "created" | "skipped"; itemId: string | null };

// This board's "Open" group id. Passed explicitly on every create because
// the board's configured top_group (where Monday puts an item when no
// group is given) is actually "Resolved", not "Open" — a pre-existing
// quirk of this specific board's setup, not something to rely on.
const ISSUES_OPEN_GROUP_ID = "group_mm5xced5";

export async function createMondayIssueItem(
  itemName: string,
  columnValues: Record<string, unknown>,
): Promise<MondayCreateItemResult> {
  const token = process.env.MONDAY_API_TOKEN;
  const boardId = process.env.MONDAY_ISSUES_BOARD_ID;
  if (!token || !boardId) return { status: "skipped", itemId: null };

  const query = `mutation ($boardId: ID!, $groupId: String!, $itemName: String!, $columnValues: JSON!) {
    create_item(board_id: $boardId, group_id: $groupId, item_name: $itemName, column_values: $columnValues) { id }
  }`;

  const data = await mondayRequest<{ create_item: { id: string } }>(token, query, {
    boardId,
    groupId: ISSUES_OPEN_GROUP_ID,
    itemName,
    columnValues: JSON.stringify(columnValues),
  });
  return { status: "created", itemId: data.create_item.id };
}

/**
 * Looks up a Monday.com user's numeric id by email, for the "Reported By"
 * people column — this app's engineers aren't otherwise linked to Monday
 * user accounts, so email (assumed shared between the two systems) is the
 * only signal available. Returns null on no match or when unconfigured, not
 * a thrown error, so a lookup miss just leaves the column unset rather than
 * failing the whole sync.
 */
export async function findMondayUserIdByEmail(email: string): Promise<number | null> {
  const token = process.env.MONDAY_API_TOKEN;
  if (!token) return null;

  const query = `query ($email: [String]) {
    users(emails: $email, limit: 1) { id }
  }`;

  const data = await mondayRequest<{ users: { id: string }[] }>(token, query, { email: [email] });
  return data.users[0] ? Number(data.users[0].id) : null;
}
