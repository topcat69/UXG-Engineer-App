import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { createMondayIssueItem, findMondayUserIdByEmail } from "./client";
import { buildIssueColumnValues, buildIssueItemName } from "./issue-payload";

type AnySupabaseClient = SupabaseClient<Database>;

/**
 * Resolving "Reported By" is a nice-to-have on top of an already-best-effort
 * sync, not a requirement of it — a failed or missing lookup shouldn't stop
 * the item being created with everything else it knows, so this is caught
 * and defaulted independently rather than left to the outer try/catch
 * (which would otherwise skip the whole item over a lookup hiccup).
 */
async function resolveRaisedByMondayUserId(email: string | null | undefined): Promise<number | null> {
  if (!email) return null;
  try {
    return await findMondayUserIdByEmail(email);
  } catch (error) {
    console.error(`Monday.com user lookup failed for ${email}`, error);
    return null;
  }
}

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
        "severity, category, description, blocks_completion, status, created_at, job:jobs!issues_job_id_fkey(job_number), raised_by_user:users!issues_raised_by_fkey(email)",
      )
      .eq("id", issueId)
      .single();
    if (!issue || !issue.job) return;

    const raisedByMondayUserId = await resolveRaisedByMondayUserId(issue.raised_by_user?.email);
    const itemName = buildIssueItemName(issue, issue.job);
    const columnValues = buildIssueColumnValues(issue, issue.job, raisedByMondayUserId);
    await createMondayIssueItem(itemName, columnValues);
  } catch (error) {
    console.error(`Monday.com sync failed for issue ${issueId}`, error);
  }
}
