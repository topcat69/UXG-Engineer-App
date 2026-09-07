"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { validatePlacement } from "@/lib/kb/validate-placement";
import type { Database } from "@/lib/supabase/database.types";

export type KbArticleRow = Database["public"]["Tables"]["kb_articles"]["Row"];
type ArticleResult = { ok: true; article: KbArticleRow } | { ok: false; message: string };
type ArticlePlacementInput = { title: string; body: string; categoryId: string; manufacturerId: string; modelRangeId: string; tags: string };

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

/**
 * The engineer-facing counterpart to office's createArticle
 * (office/knowledge-base/actions.ts) — same shape, but always lands in
 * pending_review rather than publishing directly, per the confirmed flow.
 * Shared (not under /office) since the field app calls this directly —
 * KB is online-only for v1 (see the proposal's decision #4), so this is a
 * plain Server Action like any office one, not routed through the
 * offline outbox the rest of the field app's mutations use.
 */
export async function submitArticle(input: ArticlePlacementInput): Promise<ArticleResult> {
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
      status: "pending_review",
    })
    .select("*")
    .single();
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/knowledge-base");
  return { ok: true, article: data };
}

/**
 * Revise-and-resubmit after a decline (decision #3: visible reason,
 * always resubmittable) — RLS only allows this while the article is
 * still 'draft' or 'declined' and the caller is its author (see
 * kb_articles_update in 20260907020000_knowledge_base.sql), so a
 * resubmit attempt on anything else fails at the database, not just here.
 * Clears the previous review outcome since a fresh one is now pending.
 */
export async function resubmitArticle(articleId: string, input: ArticlePlacementInput): Promise<ArticleResult> {
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
      status: "pending_review",
      decline_reason: null,
      reviewed_by: null,
      reviewed_at: null,
    })
    .eq("id", articleId)
    .select("*")
    .single();
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/knowledge-base");
  return { ok: true, article: data };
}
