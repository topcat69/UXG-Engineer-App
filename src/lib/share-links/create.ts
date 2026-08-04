import "server-only";
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/** Unguessable, unlike the ICS token: this one gates access to a specific job's report, not a per-engineer feed keyed off a non-secret id. */
function generateToken(): string {
  return randomBytes(24).toString("hex");
}

export async function createShareLinkForJob(
  supabase: SupabaseClient<Database>,
  jobId: string,
  createdBy: string,
  expiresInDays: number,
): Promise<{ token: string; expiresAt: string } | { error: string }> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("share_links").insert({
    token,
    job_id: jobId,
    expires_at: expiresAt,
    created_by: createdBy,
  });
  if (error) return { error: error.message };

  return { token, expiresAt };
}
