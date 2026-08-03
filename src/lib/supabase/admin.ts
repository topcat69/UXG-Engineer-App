import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { supabaseServiceRoleKey, supabaseUrl } from "./env";

/**
 * Service-role client. Bypasses RLS entirely — use only for server-side code
 * that has already established its own authorization (share-link lookups,
 * seed/migration scripts, background jobs). Never expose to the browser.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
