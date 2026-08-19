import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { parseMaxSequence } from "./job-number";

type AnySupabaseClient = SupabaseClient<Database>;

/** Thin DB-touching wrapper around parseMaxSequence — the actual parsing is unit tested there, this part isn't (same convention as map-markers.ts's pure transform vs. its Supabase-querying caller). */
export async function maxJobSequenceForYear(supabase: AnySupabaseClient, year: number): Promise<number> {
  const { data } = await supabase.from("jobs").select("job_number").like("job_number", `UXG-${year}-%`);
  return parseMaxSequence((data ?? []).map((row) => row.job_number), year);
}
