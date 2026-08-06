"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };
export type CreateTemplateResult = { ok: true; templateId: string } | { ok: false; message: string };

export async function createTemplate(name: string): Promise<CreateTemplateResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "Name is required." };

  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Not signed in." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_templates")
    .insert({ name: trimmed, created_by: user.id })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/templates");
  return { ok: true, templateId: data.id };
}

export async function renameTemplate(templateId: string, name: string): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "Name is required." };

  const supabase = await createClient();
  const { error } = await supabase.from("job_templates").update({ name: trimmed }).eq("id", templateId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/templates");
  return { ok: true, message: "Template renamed." };
}

export async function deleteTemplate(templateId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("job_templates").delete().eq("id", templateId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/templates");
  return { ok: true, message: "Template deleted." };
}

export type AddTemplateTaskResult =
  | { ok: true; task: { id: string; template_id: string; position: number; label: string } }
  | { ok: false; message: string };

/**
 * Returns the inserted row rather than just a message: the caller splices
 * it straight into local state instead of trusting router.refresh() to
 * deliver it, since this build's RSC refresh has proven to lag one action
 * behind under rapid sequential mutations (see DECISIONS.md).
 */
export async function addTemplateTask(templateId: string, label: string): Promise<AddTemplateTaskResult> {
  const trimmed = label.trim();
  if (!trimmed) return { ok: false, message: "Task label is required." };

  const supabase = await createClient();
  const { count } = await supabase
    .from("job_template_tasks")
    .select("id", { count: "exact", head: true })
    .eq("template_id", templateId);

  const { data, error } = await supabase
    .from("job_template_tasks")
    .insert({ template_id: templateId, label: trimmed, position: count ?? 0 })
    .select("id, template_id, position, label")
    .single();
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/templates");
  return { ok: true, task: data };
}

export async function deleteTemplateTask(taskId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("job_template_tasks").delete().eq("id", taskId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/templates");
  return { ok: true, message: "Task removed." };
}

/** Persists a full reorder in one round trip: index in the array becomes the new position. */
export async function reorderTemplateTasks(orderedTaskIds: string[]): Promise<ActionResult> {
  const supabase = await createClient();
  const updates = orderedTaskIds.map((id, position) =>
    supabase.from("job_template_tasks").update({ position }).eq("id", id),
  );
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false, message: failed.error.message };

  revalidatePath("/office/templates");
  return { ok: true, message: "Order saved." };
}
