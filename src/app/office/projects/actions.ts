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
