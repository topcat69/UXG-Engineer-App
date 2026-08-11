import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSecret } from "@/lib/webhooks/verify-secret";
import { syncIssueToMonday } from "@/lib/monday/sync-issue";

/**
 * Called by the issues-insert trigger (pg_net, see
 * supabase/migrations/20260113000000_issue_monday_webhook.sql) for every
 * new issue — office or field-raised, the latter going straight to
 * PostgREST via the outbox with no Next.js server action in that path.
 * Same "database is the only place guaranteed to see every insert"
 * reasoning as the other DB webhooks in this app.
 */
export async function POST(request: Request) {
  if (!verifyWebhookSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { issue_id?: string };
  if (!body.issue_id) return NextResponse.json({ error: "Missing issue_id" }, { status: 400 });

  const supabase = createAdminClient();
  await syncIssueToMonday(supabase, body.issue_id);

  return NextResponse.json({ ok: true });
}
