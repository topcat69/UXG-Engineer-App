import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { ScriptAdminClient } from "./supabase-admin";

/**
 * A real, RLS-scoped session for `email`, minted via the admin magic-link
 * API and redeemed exactly as a genuine sign-in would (same technique as
 * tests/helpers/rls-test-client.ts). Load-testing through the *admin*
 * client would measure the query planner alone; going through a real
 * session measures what an office user's browser actually waits on,
 * including RLS policy evaluation.
 */
export async function sessionClientFor(email: string, admin: ScriptAdminClient) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) {
    throw new Error(`generateLink failed for ${email}: ${error?.message ?? "no hashed_token"}`);
  }

  const anon = createClient<Database>(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: verified, error: verifyError } = await anon.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: "magiclink",
  });
  if (verifyError || !verified.session) {
    throw new Error(`verifyOtp failed for ${email}: ${verifyError?.message ?? "no session"}`);
  }

  const scoped = createClient<Database>(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  await scoped.auth.setSession({
    access_token: verified.session.access_token,
    refresh_token: verified.session.refresh_token,
  });
  return scoped;
}
