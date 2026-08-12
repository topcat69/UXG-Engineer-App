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

// The CRM > Issues board's "Open Issues" group id (this board's own
// top_group, unlike the Field Service Management board this app targeted
// before — passed explicitly anyway rather than relying on that holding).
const ISSUES_OPEN_GROUP_ID = "topics";

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
