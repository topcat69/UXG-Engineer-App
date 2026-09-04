"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/current-user";
import type { Database } from "@/lib/supabase/database.types";

type UserRole = Database["public"]["Enums"]["user_role"];

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  phone: string | null;
  company: string | null;
  max_jobs_per_day: number | null;
};
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
    .select("id, name, email, role, active, phone, company, max_jobs_per_day")
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
    .select("id, name, email, role, active, phone, company, max_jobs_per_day")
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
    .select("id, name, email, role, active, phone, company, max_jobs_per_day")
    .single();
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/users");
  return { ok: true, user: updated };
}

export type DeleteUserResult = { ok: true } | { ok: false; message: string };

/**
 * A real delete, not the same thing as setUserActive(false) — removes both
 * the public.users row and the underlying Supabase Auth account, freeing
 * the email up for a fresh createUser() (e.g. recreating someone whose
 * account predates Google SSO). Only works when nothing references them:
 * jobs.assigned_to/status_events.user_id/issues.raised_by/
 * share_links.created_by are all plain FKs with no cascade, by design
 * (same reasoning as deleteClientRecord/deleteSite/deleteProject — a
 * person's name should never silently vanish from job history), so anyone
 * with real activity has to stay on setUserActive(false) instead.
 *
 * public.users is deleted first (RLS + the FK checks against job history
 * both apply here) — only once that succeeds is the auth.users row removed
 * via the admin client, since public.users.id references auth.users(id)
 * with no cascade the other way either.
 */
export async function deleteUser(userId: string): Promise<DeleteUserResult> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, message: "Not signed in." };
  if (actor.id === userId) return { ok: false, message: "You can't delete your own account." };

  const supabase = await createClient();
  const { data: target } = await supabase.from("users").select("role").eq("id", userId).single();
  if (!target) return { ok: false, message: "User not found." };
  if (!canManage(actor.role, target.role)) {
    return { ok: false, message: "You don't have permission to delete this user." };
  }

  const { error: deleteError } = await supabase.from("users").delete().eq("id", userId);
  if (deleteError) {
    if (deleteError.code === "23503") {
      return {
        ok: false,
        message: "Can't delete — this user still has job history (assigned jobs, issues, or status updates) against them. Deactivate instead.",
      };
    }
    return { ok: false, message: deleteError.message };
  }

  const admin = createAdminClient();
  const { error: authError } = await admin.auth.admin.deleteUser(userId);
  if (authError) return { ok: false, message: authError.message };

  revalidatePath("/office/users");
  return { ok: true };
}

export type EditableUserFields = {
  name: string;
  email: string;
  phone: string;
  company: string;
  max_jobs_per_day: number | null;
};

/**
 * Edits a user's profile fields — everything except role/active, which
 * already have their own controls. Permission-gated the same way as
 * createUser/setUserActive (`canManage`, mirroring the users_write RLS
 * policy), checked here against the target's *current* role fetched fresh
 * rather than trusted from the client, since the email sync below goes
 * through the admin client and bypasses RLS entirely — the database can't
 * backstop that call the way it backstops the plain `.update()`.
 *
 * Keeps Supabase Auth's own email in sync with the roster: magic-link
 * sign-in looks someone up by *that* email, not this row's, so changing
 * one without the other would leave the office showing an address the
 * person can no longer actually sign in with.
 */
export async function updateUser(userId: string, fields: EditableUserFields): Promise<UpdateUserResult> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, message: "Not signed in." };

  const supabase = await createClient();
  const { data: target } = await supabase.from("users").select("role, email").eq("id", userId).single();
  if (!target) return { ok: false, message: "User not found." };
  if (!canManage(actor.role, target.role)) {
    return { ok: false, message: "You don't have permission to edit this user." };
  }

  const trimmedName = fields.name.trim();
  const trimmedEmail = fields.email.trim().toLowerCase();
  if (!trimmedName) return { ok: false, message: "Name is required." };
  if (!trimmedEmail) return { ok: false, message: "Email is required." };

  if (trimmedEmail !== target.email) {
    const admin = createAdminClient();
    const { error: authError } = await admin.auth.admin.updateUserById(userId, {
      email: trimmedEmail,
      email_confirm: true,
    });
    if (authError) return { ok: false, message: authError.message };
  }

  const { data: updated, error: updateError } = await supabase
    .from("users")
    .update({
      name: trimmedName,
      email: trimmedEmail,
      phone: fields.phone.trim() || null,
      company: fields.company.trim() || null,
      max_jobs_per_day: fields.max_jobs_per_day,
    })
    .eq("id", userId)
    .select("id, name, email, role, active, phone, company, max_jobs_per_day")
    .single();
  if (updateError) return { ok: false, message: updateError.message };

  revalidatePath("/office/users");
  return { ok: true, user: updated };
}
