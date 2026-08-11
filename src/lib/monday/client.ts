import "server-only";

const MONDAY_API_URL = "https://api.monday.com/v2";

/**
 * Returns "skipped" (not a thrown error) when MONDAY_API_TOKEN or
 * MONDAY_ISSUES_BOARD_ID isn't set, so issue sync stays best-effort —
 * same non-blocking contract as Calendar sync and Resend email: an
 * unconfigured integration must never stop an issue being raised.
 */
export type MondayCreateItemResult = { status: "created" | "skipped"; itemId: string | null };

export async function createMondayIssueItem(
  itemName: string,
  columnValues: Record<string, unknown>,
): Promise<MondayCreateItemResult> {
  const token = process.env.MONDAY_API_TOKEN;
  const boardId = process.env.MONDAY_ISSUES_BOARD_ID;
  if (!token || !boardId) return { status: "skipped", itemId: null };

  const query = `mutation ($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
    create_item(board_id: $boardId, item_name: $itemName, column_values: $columnValues) { id }
  }`;

  const response = await fetch(MONDAY_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: token },
    body: JSON.stringify({
      query,
      variables: { boardId, itemName, columnValues: JSON.stringify(columnValues) },
    }),
  });

  const body = (await response.json()) as { data?: { create_item: { id: string } }; errors?: unknown };
  if (!response.ok || body.errors || !body.data) {
    throw new Error(`Monday.com create_item failed: ${JSON.stringify(body.errors ?? response.statusText)}`);
  }
  return { status: "created", itemId: body.data.create_item.id };
}
