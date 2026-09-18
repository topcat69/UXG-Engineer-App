"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSuperadminUser } from "@/lib/auth/current-user";
import type { Database } from "@/lib/supabase/database.types";

export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
export type CreateProjectResult = { ok: true; project: ProjectRow } | { ok: false; message: string };

export async function createProject(input: {
  name: string;
  client_id: string;
  start_date?: string;
  end_date?: string;
  status?: string;
}): Promise<CreateProjectResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, message: "Name is required." };
  if (!input.client_id) return { ok: false, message: "Select a customer." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      name,
      client_id: input.client_id,
      start_date: input.start_date || undefined,
      end_date: input.end_date || undefined,
      status: input.status || undefined,
    })
    .select("*")
    .single();
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/projects");
  revalidatePath(`/office/clients/${input.client_id}`);
  return { ok: true, project: data };
}

export type UpdateProjectResult = { ok: true; project: ProjectRow } | { ok: false; message: string };

/**
 * Everything a project was created with can also be changed afterwards —
 * marking one on_hold/completed once it wraps up, or adding an end date
 * that wasn't known at creation time. No app-level role check (matching
 * createProject's own contract, unlike users' updateUser which needs one
 * because its email-sync step goes through the admin client and bypasses
 * RLS entirely) — projects_update RLS already restricts this to
 * manager/superadmin, same policy createProject's insert already relies on.
 */
export async function updateProject(
  id: string,
  input: { name: string; client_id: string; start_date?: string; end_date?: string; status: string },
): Promise<UpdateProjectResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, message: "Name is required." };
  if (!input.client_id) return { ok: false, message: "Select a customer." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .update({
      name,
      client_id: input.client_id,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      status: input.status,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/projects");
  revalidatePath(`/office/clients/${input.client_id}`);
  return { ok: true, project: data };
}

export type ArchiveProjectResult = { ok: true } | { ok: false; message: string };

/**
 * End-of-project/end-of-year housekeeping — takes a project out of the
 * "active" pickers used when creating new work (job creation, job
 * sheets, import), but changes nothing else: its jobs, sites, and Drive
 * files stay exactly where they are, and it stays visible here and in
 * Reports. Superadmin-only, enforced twice over: requireSuperadminUser
 * below (so a manager never even sees this succeed), and the
 * archive_project RPC itself re-checks the role server-side — RLS's
 * projects_update policy alone would let a manager do this too, since it
 * can't be scoped to just these two columns (same reasoning as
 * set_own_theme).
 */
export async function archiveProject(id: string): Promise<ArchiveProjectResult> {
  await requireSuperadminUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("archive_project", { project_id: id });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/projects");
  return { ok: true };
}

export async function unarchiveProject(id: string): Promise<ArchiveProjectResult> {
  await requireSuperadminUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("unarchive_project", { project_id: id });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/projects");
  return { ok: true };
}

export type DeleteProjectResult = { ok: true } | { ok: false; message: string };

/** A project can't be deleted while it still has jobs (or an active share link) against it — the FK is a plain RESTRICT (no cascade), same reasoning as deleteClientRecord/deleteSite: deleting a project should never silently take job history with it. */
export async function deleteProject(id: string): Promise<DeleteProjectResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return { ok: false, message: "Can't delete — this project still has jobs (or a share link) against it." };
    }
    return { ok: false, message: error.message };
  }

  revalidatePath("/office/projects");
  return { ok: true };
}
