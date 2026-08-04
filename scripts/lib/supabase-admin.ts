import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * A standalone-script equivalent of `src/lib/supabase/admin.ts`'s
 * `createAdminClient` — deliberately duplicated rather than imported,
 * because that module (and everything it pulls in, like the Calendar
 * client) starts with `import "server-only"`, which throws unconditionally
 * outside a bundler that understands the `react-server` export condition.
 * Next.js's webpack sets that condition; a plain `tsx` script does not, so
 * importing the app's module directly here would throw on the very first
 * line before the migration ever runs. Same client, same config, no
 * bundler-only guard that doesn't apply to a CLI script.
 */
export function createScriptAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.");
  }
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type ScriptAdminClient = ReturnType<typeof createScriptAdminClient>;
