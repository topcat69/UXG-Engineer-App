import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type UserRole = Database["public"]["Enums"]["user_role"];

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  theme: string;
};

/**
 * A deactivated account (users.active = false, set by "delete user" in
 * /office/users) is treated as not signed in at all, even with a valid
 * Supabase Auth session — every caller already redirects to /login on a
 * null return, which is exactly the right outcome here too.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.from("users").select("id, email, name, role, active, theme").eq("id", user.id).single();
  // A real query failure (e.g. a column this select expects, like `theme`,
  // missing because a migration hasn't been deployed yet) looks identical
  // to "not signed in" to every caller here — every one of them redirects
  // to /login on a null return, same as an actually-missing row would.
  // That's the right behavior (never show a broken page to a real user),
  // but it made a schema/app mismatch across a whole deploy indistinguishable
  // from "wrong magic link code" with zero clue in the UI why. Logging it
  // loudly server-side is the only place this can surface now.
  if (error) console.error("getCurrentUser: users select failed", error);
  if (!data || !data.active) return null;

  // Magic link is superadmin-only once Google Workspace SSO is live
  // (GOOGLE_SSO_ENFORCED="true" in .env.production — off by default so
  // local dev, CI, and any environment without Google OAuth configured in
  // Supabase keep working on magic link for every role). A non-Google
  // session on a non-superadmin account is then treated as not signed in,
  // same as a deactivated account above.
  const ssoEnforced = process.env.GOOGLE_SSO_ENFORCED === "true";
  if (ssoEnforced && user.app_metadata.provider === "email" && data.role !== "superadmin") return null;

  return data;
}

/** Redirects to /login if not signed in, or to / if signed in but not superadmin/manager. */
export async function requireOfficeUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "superadmin" && user.role !== "manager") redirect("/");
  return user;
}
