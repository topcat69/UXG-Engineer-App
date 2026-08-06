"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/current-user";
import type { Database } from "@/lib/supabase/database.types";

type UserRole = Database["public"]["Enums"]["user_role"];

export type UserRow = { id: string; name: string; email: string; role: UserRole; active: boolean };
export type CreateUserResult = { ok: true; user: UserRow } | { ok: false; message: string };
export type UpdateUserResult = { ok: true; user: UserRow } | { ok: false; message: string };

/** Mirrors the users_write RLS policy: superadmin unrestricted, manager engineer-only. */
function canManage(actorRole: UserRole, targetRole: UserRole): boolean {
  return actorRole === "superadmin" || (actorRole === "manager" && targetRole === "engineer");
}

/**
 * Creates the real Supabase Auth account (needs the admin client — no RLS
 * equivalent exists for auth.admin.createUser) and then sets its name/role
 * on the public.users row the on_auth_user_created trigger already
 * inserted. That second step deliberately uses the ordinary session client,
 * not the admin one: RLS's users_write policy re-checks the same
 * superadmin/manager-engineer-only boundary as `canManage` below, so a bug
 * in this action's own check doesn't silently become a privilege escalation
 * — the database still enforces it independently.
 */
export async function createUser(name: string, email: string, role: UserRole): Promise<CreateUserResult> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, message: "Not signed in." };
  if (!canManage(actor.role, role)) {
    return { ok: false, message: "You don't have permission to create a user with that role." };
  }

  const trimmedName = name.trim();
  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedName) return { ok: false, message: "Name is required." };
  if (!trimmedEmail) return { ok: false, message: "Email is required." };

  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: trimmedEmail,
    email_confirm: true,
    user_metadata: { name: trimmedName },
  });
  if (createError || !created.user) {
    return { ok: false, message: createError?.message ?? "Failed to create the account." };
  }

  const supabase = await createClient();
  const { data: updated, error: updateError } = await supabase
    .from("users")
    .update({ name: trimmedName, role })
    .eq("id", created.user.id)
    .select("id, name, email, role, active")
    .single();
  if (updateError) return { ok: false, message: updateError.message };

  revalidatePath("/office/users");
  return { ok: true, user: updated };
}

/** Deactivating blocks sign-in (see getCurrentUser); it never deletes the row, so past job/status/issue history keeps the name attached. */
export async function setUserActive(userId: string, active: boolean): Promise<UpdateUserResult> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, message: "Not signed in." };
  if (actor.id === userId && !active) return { ok: false, message: "You can't deactivate your own account." };

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("users")
    .update({ active })
    .eq("id", userId)
    .select("id, name, email, role, active")
    .single();
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/users");
  return { ok: true, user: updated };
}

/** Superadmin only — RLS's users_write `with check` also blocks a manager from setting anything but 'engineer'. */
export async function changeUserRole(userId: string, role: UserRole): Promise<UpdateUserResult> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, message: "Not signed in." };
  if (actor.role !== "superadmin") return { ok: false, message: "Only a superadmin can change a user's role." };

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("users")
    .update({ role })
    .eq("id", userId)
    .select("id, name, email, role, active")
    .single();
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/users");
  return { ok: true, user: updated };
}
