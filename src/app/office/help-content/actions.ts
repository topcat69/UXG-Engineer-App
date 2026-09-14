"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import type { Database } from "@/lib/supabase/database.types";

type UserRole = Database["public"]["Enums"]["user_role"];

export type ActionResult = { ok: true } | { ok: false; message: string };
export type CategoryResult = { ok: true; id: string } | { ok: false; message: string };
export type ArticleResult = { ok: true; id: string } | { ok: false; message: string };

// --- Categories ---

/**
 * A child category always carries its parent's role, never the role
 * passed in — see help_categories.role's own doc comment in
 * 20260915000000_help_guides.sql on why every row needs a directly-set
 * role rather than one inherited by walking the tree at read time.
 */
export async function createHelpCategory(name: string, role: UserRole | null, parentId: string | null): Promise<CategoryResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "Name is required." };

  const supabase = await createClient();

  let effectiveRole = role;
  if (parentId) {
    const { data: parent } = await supabase.from("help_categories").select("role").eq("id", parentId).single();
    effectiveRole = parent?.role ?? null;
  }

  const siblingQuery = supabase.from("help_categories").select("id", { count: "exact", head: true });
  const { count } = await (parentId ? siblingQuery.eq("parent_id", parentId) : siblingQuery.is("parent_id", null));

  const { data, error } = await supabase
    .from("help_categories")
    .insert({ name: trimmed, role: effectiveRole, parent_id: parentId, position: count ?? 0 })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/help-content");
  revalidatePath("/help");
  return { ok: true, id: data.id };
}

/** Renaming a top-level category's role cascades onto its direct children, keeping the denormalized invariant intact — see createHelpCategory's comment. */
export async function updateHelpCategory(id: string, name: string, role: UserRole | null): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "Name is required." };

  const supabase = await createClient();
  const { data: category, error } = await supabase
    .from("help_categories")
    .update({ name: trimmed, role })
    .eq("id", id)
    .select("parent_id")
    .single();
  if (error) return { ok: false, message: error.message };

  if (!category.parent_id) {
    const { error: cascadeError } = await supabase.from("help_categories").update({ role }).eq("parent_id", id);
    if (cascadeError) return { ok: false, message: cascadeError.message };
  }

  revalidatePath("/office/help-content");
  revalidatePath("/help");
  return { ok: true };
}

/** Cascades to its articles and their images (help_articles/help_article_images both on delete cascade), and to any subcategories. */
export async function deleteHelpCategory(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("help_categories").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/help-content");
  revalidatePath("/help");
  return { ok: true };
}

// --- Articles ---

export async function createHelpArticle(categoryId: string, title: string, body: string): Promise<ArticleResult> {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return { ok: false, message: "Title is required." };

  const user = await getCurrentUser();
  const supabase = await createClient();
  const { count } = await supabase.from("help_articles").select("id", { count: "exact", head: true }).eq("category_id", categoryId);

  const { data, error } = await supabase
    .from("help_articles")
    .insert({
      category_id: categoryId,
      title: trimmedTitle,
      body: body.trim(),
      position: count ?? 0,
      created_by: user?.id,
      updated_by: user?.id,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/help-content");
  revalidatePath("/help");
  return { ok: true, id: data.id };
}

export async function updateHelpArticle(id: string, title: string, body: string): Promise<ActionResult> {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return { ok: false, message: "Title is required." };

  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("help_articles")
    .update({ title: trimmedTitle, body: body.trim(), updated_by: user?.id })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/help-content");
  revalidatePath("/help");
  return { ok: true };
}

export async function deleteHelpArticle(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("help_articles").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/help-content");
  revalidatePath("/help");
  return { ok: true };
}

// --- Images ---

export type UploadImageResult = { ok: true; id: string; storagePath: string } | { ok: false; message: string };

export async function uploadHelpArticleImage(articleId: string, formData: FormData): Promise<UploadImageResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose a file first." };
  const caption = String(formData.get("caption") ?? "").trim() || null;

  const supabase = await createClient();
  const { count } = await supabase
    .from("help_article_images")
    .select("id", { count: "exact", head: true })
    .eq("article_id", articleId);

  const storagePath = `${articleId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from("help-media").upload(storagePath, file, { contentType: file.type || undefined });
  if (uploadError) return { ok: false, message: uploadError.message };

  const { data, error } = await supabase
    .from("help_article_images")
    .insert({ article_id: articleId, storage_path: storagePath, caption, position: count ?? 0 })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/help-content");
  revalidatePath("/help");
  return { ok: true, id: data.id, storagePath };
}

export async function deleteHelpArticleImage(id: string, storagePath: string): Promise<ActionResult> {
  const supabase = await createClient();
  await supabase.storage.from("help-media").remove([storagePath]);
  const { error } = await supabase.from("help_article_images").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/help-content");
  revalidatePath("/help");
  return { ok: true };
}

// --- Video ---

export type UploadVideoResult = { ok: true; videoPath: string } | { ok: false; message: string };

export async function uploadHelpArticleVideo(articleId: string, formData: FormData): Promise<UploadVideoResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose a file first." };

  const supabase = await createClient();
  const storagePath = `${articleId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from("help-media").upload(storagePath, file, { contentType: file.type || undefined });
  if (uploadError) return { ok: false, message: uploadError.message };

  const { error } = await supabase.from("help_articles").update({ video_path: storagePath }).eq("id", articleId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/help-content");
  revalidatePath("/help");
  return { ok: true, videoPath: storagePath };
}

export async function deleteHelpArticleVideo(articleId: string, videoPath: string): Promise<ActionResult> {
  const supabase = await createClient();
  await supabase.storage.from("help-media").remove([videoPath]);
  const { error } = await supabase.from("help_articles").update({ video_path: null }).eq("id", articleId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/help-content");
  revalidatePath("/help");
  return { ok: true };
}
