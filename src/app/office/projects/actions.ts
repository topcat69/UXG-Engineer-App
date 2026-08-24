"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
export type CreateProjectResult = { ok: true; project: ProjectRow } | { ok: false; message: string };

export async function createProject(input: {
  name: string;
  start_date?: string;
  end_date?: string;
  status?: string;
}): Promise<CreateProjectResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, message: "Name is required." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      name,
      start_date: input.start_date || undefined,
      end_date: input.end_date || undefined,
      status: input.status || undefined,
    })
    .select("*")
    .single();
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/projects");
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
  input: { name: string; start_date?: string; end_date?: string; status: string },
): Promise<UpdateProjectResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, message: "Name is required." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .update({
      name,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      status: input.status,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/projects");
  return { ok: true, project: data };
}
