"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useIsOnline } from "@/lib/offline/use-is-online";

type Category = { id: string; parent_id: string | null; name: string };
type Article = { id: string; category_id: string; title: string; body: string; video_path: string | null };
type ImageRow = { id: string; article_id: string; storage_path: string; caption: string | null };

/**
 * Same "online-only, no Dexie/outbox" contract as KnowledgeBaseView —
 * Help is reference material, not something an engineer needs mid-job
 * with no signal, so it queries Supabase directly rather than adding
 * offline caching machinery for it.
 */
export function HelpView({ onBack }: { onBack: () => void }) {
  const isOnline = useIsOnline();
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [articles, setArticles] = useState<Article[] | null>(null);
  const [images, setImages] = useState<(ImageRow & { url: string | null })[] | null>(null);
  const [videoUrls, setVideoUrls] = useState<Map<string, string | null>>(new Map());

  useEffect(() => {
    if (!isOnline) return;
    const supabase = createClient();

    supabase
      .from("help_categories")
      .select("id, parent_id, name")
      .order("position")
      .order("name")
      .then(({ data }) => setCategories(data ?? []));

    supabase
      .from("help_articles")
      .select("id, category_id, title, body, video_path")
      .order("position")
      .then(async ({ data }) => {
        const rows = data ?? [];
        setArticles(rows);
        const withVideos = await Promise.all(
          rows
            .filter((a) => a.video_path)
            .map(async (a) => {
              const { data: signed } = await supabase.storage.from("help-media").createSignedUrl(a.video_path!, 3600);
              return [a.id, signed?.signedUrl ?? null] as const;
            }),
        );
        setVideoUrls(new Map(withVideos));
      });

    supabase
      .from("help_article_images")
      .select("id, article_id, storage_path, caption")
      .order("position")
      .then(async ({ data }) => {
        const rows = data ?? [];
        const withUrls = await Promise.all(
          rows.map(async (img) => {
            const { data: signed } = await supabase.storage.from("help-media").createSignedUrl(img.storage_path, 3600);
            return { ...img, url: signed?.signedUrl ?? null };
          }),
        );
        setImages(withUrls);
      });
  }, [isOnline]);

  if (!isOnline) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <button type="button" onClick={onBack} className="text-muted-foreground text-sm underline">
          ← Back
        </button>
        <p className="text-muted-foreground text-sm">You&apos;re offline — Help needs a connection.</p>
      </div>
    );
  }

  if (categories === null || articles === null || images === null) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <button type="button" onClick={onBack} className="text-muted-foreground text-sm underline">
          ← Back
        </button>
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  const topLevel = categories.filter((c) => !c.parent_id);
  const articlesOf = (categoryId: string) => articles.filter((a) => a.category_id === categoryId);
  const imagesOf = (articleId: string) => images.filter((i) => i.article_id === articleId);

  return (
    <div className="flex flex-col gap-6 p-4 pb-24">
      <button type="button" onClick={onBack} className="text-muted-foreground text-sm underline">
        ← Back
      </button>
      <h1 className="text-lg font-semibold">Help</h1>

      {topLevel.length === 0 && <p className="text-muted-foreground text-sm">Nothing here yet — check back soon.</p>}

      {topLevel.map((category) => (
        <section key={category.id} className="flex flex-col gap-4">
          <h2 className="font-medium">{category.name}</h2>
          {articlesOf(category.id).map((article) => (
            <article key={article.id} className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">{article.title}</h3>
              <p className="text-muted-foreground text-sm whitespace-pre-wrap">{article.body}</p>
              {imagesOf(article.id).map(
                (img) =>
                  img.url && (
                    // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL, not an optimizable static asset
                    <img key={img.id} src={img.url} alt={img.caption ?? article.title} className="max-w-full rounded-md border" />
                  ),
              )}
              {article.video_path && videoUrls.get(article.id) && (
                <video controls src={videoUrls.get(article.id)!} className="max-w-full rounded-md border" />
              )}
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
