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

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("users").select("id, email, name, role").eq("id", user.id).single();
  if (!data) return null;

  return data;
}

/** Redirects to /login if not signed in, or to / if signed in but not admin/manager. */
export async function requireOfficeUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin" && user.role !== "manager") redirect("/");
  return user;
}
