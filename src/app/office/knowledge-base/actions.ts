"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { validatePlacement } from "@/lib/kb/validate-placement";
import type { Database } from "@/lib/supabase/database.types";

export type KbCategoryRow = Database["public"]["Tables"]["kb_categories"]["Row"];
export type KbManufacturerRow = Database["public"]["Tables"]["kb_manufacturers"]["Row"];
export type KbModelRangeRow = Database["public"]["Tables"]["kb_model_ranges"]["Row"];
export type KbArticleRow = Database["public"]["Tables"]["kb_articles"]["Row"];
export type KbAttachmentRow = Database["public"]["Tables"]["kb_article_attachments"]["Row"];

type Result = { ok: true } | { ok: false; message: string };
type CategoryResult = { ok: true; item: KbCategoryRow } | { ok: false; message: string };
type ManufacturerResult = { ok: true; item: KbManufacturerRow } | { ok: false; message: string };
type ModelRangeResult = { ok: true; item: KbModelRangeRow } | { ok: false; message: string };
type ArticleResult = { ok: true; article: KbArticleRow } | { ok: false; message: string };

/** RESTRICT, no cascade — a category still filed against by an article, or with manufacturers under it, can't be silently deleted out from under either. */
export async function createCategory(name: string): Promise<CategoryResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "Name is required." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("kb_categories").insert({ name: trimmed }).select("*").single();
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/knowledge-base");
  return { ok: true, item: data };
}

export async function updateCategory(categoryId: string, name: string): Promise<CategoryResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "Name is required." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("kb_categories").update({ name: trimmed }).eq("id", categoryId).select("*").single();
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/knowledge-base");
  return { ok: true, item: data };
}

export async function deleteCategory(categoryId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("kb_categories").delete().eq("id", categoryId);
  if (error) {
    if (error.code === "23503") {
      return { ok: false, message: "Can't delete — at least one article or manufacturer is still filed under this category." };
    }
    return { ok: false, message: error.message };
  }

  revalidatePath("/office/knowledge-base");
  return { ok: true };
}

/** RESTRICT, no cascade — same reasoning as deleteCategory, one level down (articles and/or model ranges block the delete). */
export async function createManufacturer(categoryId: string, name: string): Promise<ManufacturerResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "Name is required." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kb_manufacturers")
    .insert({ category_id: categoryId, name: trimmed })
    .select("*")
    .single();
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/knowledge-base");
  return { ok: true, item: data };
}

export async function updateManufacturer(manufacturerId: string, name: string): Promise<ManufacturerResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "Name is required." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kb_manufacturers")
    .update({ name: trimmed })
    .eq("id", manufacturerId)
    .select("*")
    .single();
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/knowledge-base");
  return { ok: true, item: data };
}

export async function deleteManufacturer(manufacturerId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("kb_manufacturers").delete().eq("id", manufacturerId);
  if (error) {
    if (error.code === "23503") {
      return { ok: false, message: "Can't delete — at least one article or model range is still filed under this manufacturer." };
    }
    return { ok: false, message: error.message };
  }

  revalidatePath("/office/knowledge-base");
  return { ok: true };
}

/** RESTRICT, no cascade — same reasoning again; an article filed at this level blocks the delete. */
export async function createModelRange(manufacturerId: string, name: string): Promise<ModelRangeResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "Name is required." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kb_model_ranges")
    .insert({ manufacturer_id: manufacturerId, name: trimmed })
    .select("*")
    .single();
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/knowledge-base");
  return { ok: true, item: data };
}

export async function updateModelRange(modelRangeId: string, name: string): Promise<ModelRangeResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "Name is required." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kb_model_ranges")
    .update({ name: trimmed })
    .eq("id", modelRangeId)
    .select("*")
    .single();
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/knowledge-base");
  return { ok: true, item: data };
}

export async function deleteModelRange(modelRangeId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("kb_model_ranges").delete().eq("id", modelRangeId);
  if (error) {
    if (error.code === "23503") {
      return { ok: false, message: "Can't delete — at least one article is still filed under this model range." };
    }
    return { ok: false, message: error.message };
  }

  revalidatePath("/office/knowledge-base");
  return { ok: true };
}

function parseTags(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  );
}

export type ArticlePlacementInput = {
  title: string;
  body: string;
  categoryId: string;
  manufacturerId: string;
  modelRangeId: string;
  tags: string;
};

/**
 * Office writes and publishes directly — no separate draft/review step for
 * office-authored content, per the confirmed flow (office gets the same
 * trust level job templates already get). Compare submitArticle in
 * src/lib/kb/actions.ts, which is the engineer-facing equivalent and goes
 * to pending_review instead.
 */
export async function createArticle(input: ArticlePlacementInput): Promise<ArticleResult> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, message: "Not signed in." };

  const title = input.title.trim();
  const body = input.body.trim();
  if (!title) return { ok: false, message: "Title is required." };
  if (!body) return { ok: false, message: "Body is required." };
  if (!input.categoryId) return { ok: false, message: "Category is required." };

  const supabase = await createClient();
  const placementError = await validatePlacement(supabase, input.categoryId, input.manufacturerId, input.modelRangeId);
  if (placementError) return { ok: false, message: placementError };

  const { data, error } = await supabase
    .from("kb_articles")
    .insert({
      title,
      body,
      category_id: input.categoryId,
      manufacturer_id: input.manufacturerId || null,
      model_range_id: input.modelRangeId || null,
      tags: parseTags(input.tags),
      author_id: actor.id,
      status: "published",
    })
    .select("*")
    .single();
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/knowledge-base");
  return { ok: true, article: data };
}

/** Office can edit any article's content regardless of status — content moderation authority, same as it can delete any article. */
export async function updateArticle(articleId: string, input: ArticlePlacementInput): Promise<ArticleResult> {
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title) return { ok: false, message: "Title is required." };
  if (!body) return { ok: false, message: "Body is required." };
  if (!input.categoryId) return { ok: false, message: "Category is required." };

  const supabase = await createClient();
  const placementError = await validatePlacement(supabase, input.categoryId, input.manufacturerId, input.modelRangeId);
  if (placementError) return { ok: false, message: placementError };

  const { data, error } = await supabase
    .from("kb_articles")
    .update({
      title,
      body,
      category_id: input.categoryId,
      manufacturer_id: input.manufacturerId || null,
      model_range_id: input.modelRangeId || null,
      tags: parseTags(input.tags),
    })
    .eq("id", articleId)
    .select("*")
    .single();
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/knowledge-base");
  revalidatePath(`/office/knowledge-base/${articleId}`);
  return { ok: true, article: data };
}

export async function deleteArticle(articleId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("kb_articles").delete().eq("id", articleId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/knowledge-base");
  return { ok: true };
}

export async function approveArticle(articleId: string): Promise<ArticleResult> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, message: "Not signed in." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kb_articles")
    .update({ status: "published", reviewed_by: actor.id, reviewed_at: new Date().toISOString(), decline_reason: null })
    .eq("id", articleId)
    .select("*")
    .single();
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/knowledge-base");
  revalidatePath(`/office/knowledge-base/${articleId}`);
  return { ok: true, article: data };
}

/** Reason is mandatory — see decision #3 in the confirmed proposal: a decline always shows the author a visible reason, never a silent disappearance. */
export async function declineArticle(articleId: string, reason: string): Promise<ArticleResult> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, message: "Not signed in." };

  const trimmedReason = reason.trim();
  if (!trimmedReason) return { ok: false, message: "A reason is required when declining." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kb_articles")
    .update({ status: "declined", reviewed_by: actor.id, reviewed_at: new Date().toISOString(), decline_reason: trimmedReason })
    .eq("id", articleId)
    .select("*")
    .single();
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/knowledge-base");
  revalidatePath(`/office/knowledge-base/${articleId}`);
  return { ok: true, article: data };
}

export type UploadAttachmentResult = { ok: true; attachment: KbAttachmentRow } | { ok: false; message: string };

export async function uploadAttachment(articleId: string, formData: FormData): Promise<UploadAttachmentResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose a file first." };

  const supabase = await createClient();
  const storagePath = `kb-articles/${articleId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from("kb-attachments").upload(storagePath, file, {
    contentType: file.type || undefined,
  });
  if (uploadError) return { ok: false, message: uploadError.message };

  const { data, error } = await supabase
    .from("kb_article_attachments")
    .insert({ article_id: articleId, storage_path: storagePath, filename: file.name })
    .select("*")
    .single();
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/office/knowledge-base/${articleId}`);
  return { ok: true, attachment: data };
}

export async function deleteAttachment(attachmentId: string, articleId: string, storagePath: string): Promise<Result> {
  const supabase = await createClient();
  const { error: removeError } = await supabase.storage.from("kb-attachments").remove([storagePath]);
  if (removeError) return { ok: false, message: removeError.message };

  const { error } = await supabase.from("kb_article_attachments").delete().eq("id", attachmentId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/office/knowledge-base/${articleId}`);
  return { ok: true };
}
