import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ArticleDetail } from "./article-detail";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

export default async function KbArticleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: article, error }, { data: categories }, { data: manufacturers }, { data: modelRanges }, { data: attachments }] =
    await Promise.all([
      supabase
        .from("kb_articles")
        .select(
          "*, category:kb_categories(id, name), manufacturer:kb_manufacturers(id, name), model_range:kb_model_ranges(id, name), author:users!kb_articles_author_id_fkey(name), reviewer:users!kb_articles_reviewed_by_fkey(name)",
        )
        .eq("id", id)
        .single(),
      supabase.from("kb_categories").select("*").order("name"),
      supabase.from("kb_manufacturers").select("*").order("name"),
      supabase.from("kb_model_ranges").select("*").order("name"),
      supabase.from("kb_article_attachments").select("*").eq("article_id", id).order("created_at"),
    ]);

  if (error || !article) notFound();

  const attachmentsWithUrls = await Promise.all(
    (attachments ?? []).map(async (a) => {
      const { data } = await supabase.storage.from("kb-attachments").createSignedUrl(a.storage_path, SIGNED_URL_TTL_SECONDS);
      return { ...a, url: data?.signedUrl ?? null };
    }),
  );

  return (
    <ArticleDetail
      article={article}
      categories={categories ?? []}
      manufacturers={manufacturers ?? []}
      modelRanges={modelRanges ?? []}
      attachments={attachmentsWithUrls}
    />
  );
}
