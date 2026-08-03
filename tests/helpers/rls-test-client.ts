import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Run 'pnpm db:start' and 'npx supabase status -o env' ` +
        `to populate .env.local, or export it in CI.`,
    );
  }
  return value;
}

export function adminClient(): SupabaseClient<Database> {
  return createClient<Database>(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Returns a Supabase client authenticated as the given seeded user, via a
 * real GoTrue session — not a mock. Uses the admin `generateLink` API to
 * mint a magic-link token without actually sending an email, then redeems
 * it with `verifyOtp`, exactly as a real magic-link sign-in would.
 */
export async function clientForUser(email: string): Promise<SupabaseClient<Database>> {
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) {
    throw new Error(`generateLink failed for ${email}: ${error?.message ?? "no hashed_token"}`);
  }

  const anon = createClient<Database>(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: verified, error: verifyError } = await anon.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: "magiclink",
  });
  if (verifyError || !verified.session) {
    throw new Error(`verifyOtp failed for ${email}: ${verifyError?.message ?? "no session"}`);
  }

  const scoped = createClient<Database>(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await scoped.auth.setSession({
    access_token: verified.session.access_token,
    refresh_token: verified.session.refresh_token,
  });
  return scoped;
}
