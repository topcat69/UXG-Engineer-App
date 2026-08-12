import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { createMondayIssueItem } from "./client";
import { buildIssueColumnValues, buildIssueItemName } from "./issue-payload";

type AnySupabaseClient = SupabaseClient<Database>;

/**
 * Fetches the issue + its job, creates a Monday.com item on the Issues
 * board. Best-effort, same contract as syncCalendarForJob and
 * sendJobEmail: a Monday.com failure (including "not configured") never
 * throws back into the caller, since raising an issue must succeed
 * regardless of whether this integration is reachable.
 */
export async function syncIssueToMonday(supabase: AnySupabaseClient, issueId: string): Promise<void> {
  try {
    const { data: issue } = await supabase
      .from("issues")
      .select(
        "severity, category, description, blocks_completion, status, created_at, job:jobs!issues_job_id_fkey(job_number), raised_by_user:users!issues_raised_by_fkey(name)",
      )
      .eq("id", issueId)
      .single();
    if (!issue || !issue.job) return;

    const itemName = buildIssueItemName(issue, issue.job);
    const columnValues = buildIssueColumnValues(issue, issue.job, issue.raised_by_user?.name);
    await createMondayIssueItem(itemName, columnValues);
  } catch (error) {
    console.error(`Monday.com sync failed for issue ${issueId}`, error);
  }
}
