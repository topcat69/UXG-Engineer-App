import { buildLookup } from "@/lib/migration/csv-helpers";
import type { ScriptAdminClient } from "./supabase-admin";

/** Media migration runs as a separate, later step after jobs/users already exist (from migrate-appsheet.ts or the ordinary app), so its lookups come from the live database rather than from CSVs. */
export async function buildJobLookup(supabase: ScriptAdminClient) {
  const { data, error } = await supabase.from("jobs").select("id, job_number");
  if (error) throw new Error(`Failed to load jobs for lookup: ${error.message}`);
  return buildLookup((data ?? []).map((j) => ({ key: j.job_number, id: j.id })));
}

export async function buildUserLookup(supabase: ScriptAdminClient) {
  const { data, error } = await supabase.from("users").select("id, email");
  if (error) throw new Error(`Failed to load users for lookup: ${error.message}`);
  return buildLookup((data ?? []).map((u) => ({ key: u.email, id: u.id })));
}
