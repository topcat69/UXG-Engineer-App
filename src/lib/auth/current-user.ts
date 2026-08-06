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

  const { data } = await supabase.from("users").select("id, email, name, role, active").eq("id", user.id).single();
  if (!data || !data.active) return null;

  return data;
}

/** Redirects to /login if not signed in, or to / if signed in but not superadmin/manager. */
export async function requireOfficeUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "superadmin" && user.role !== "manager") redirect("/");
  return user;
}
