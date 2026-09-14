import { createClient } from "@/lib/supabase/server";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

type Category = { id: string; parent_id: string | null; name: string; position: number };
type Article = { id: string; category_id: string; title: string; body: string; video_path: string | null; position: number };
type ImageRow = { id: string; article_id: string; storage_path: string; caption: string | null; position: number };

/**
 * What shows here is entirely governed by help_categories/help_articles'
 * own RLS (see 20260915000000_help_guides.sql) — a plain unfiltered
 * select already only returns what this viewer's role is allowed to see,
 * so there's no role-filtering logic to write here at all.
 */
export default async function HelpPage() {
  const supabase = await createClient();

  const [{ data: categories, error }, { data: articles }, { data: images }] = await Promise.all([
    supabase.from("help_categories").select("id, parent_id, name, position").order("position").order("name"),
    supabase.from("help_articles").select("id, category_id, title, body, video_path, position").order("position"),
    supabase.from("help_article_images").select("id, article_id, storage_path, caption, position").order("position"),
  ]);

  if (error) {
    return <p className="text-destructive">Failed to load Help: {error.message}</p>;
  }

  const allCategories = (categories ?? []) as Category[];
  const allArticles = (articles ?? []) as Article[];
  const allImages = (images ?? []) as ImageRow[];

  const imagesWithUrls = await Promise.all(
    allImages.map(async (img) => {
      const { data } = await supabase.storage.from("help-media").createSignedUrl(img.storage_path, SIGNED_URL_TTL_SECONDS);
      return { ...img, url: data?.signedUrl ?? null };
    }),
  );
  const videoUrlByArticleId = new Map(
    await Promise.all(
      allArticles
        .filter((a) => a.video_path)
        .map(async (a) => {
          const { data } = await supabase.storage.from("help-media").createSignedUrl(a.video_path!, SIGNED_URL_TTL_SECONDS);
          return [a.id, data?.signedUrl ?? null] as const;
        }),
    ),
  );

  const topLevel = allCategories.filter((c) => !c.parent_id);
  const childrenOf = (parentId: string) => allCategories.filter((c) => c.parent_id === parentId);
  const articlesOf = (categoryId: string) => allArticles.filter((a) => a.category_id === categoryId);
  const imagesOf = (articleId: string) => imagesWithUrls.filter((i) => i.article_id === articleId);

  if (topLevel.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">Help</h1>
        <p className="text-muted-foreground text-sm">Nothing here yet — check back soon.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-xl font-semibold">Help</h1>
        <p className="text-muted-foreground text-sm">Guides for what you can do in this app.</p>
      </div>

      <nav className="flex flex-col gap-1 rounded-md border p-4 text-sm">
        {topLevel.map((cat) => (
          <a key={cat.id} href={`#${cat.id}`} className="underline-offset-2 hover:underline">
            {cat.name}
          </a>
        ))}
      </nav>

      {topLevel.map((category) => (
        <section key={category.id} id={category.id} className="flex flex-col gap-6">
          <h2 className="text-lg font-semibold">{category.name}</h2>

          {articlesOf(category.id).map((article) => (
            <ArticleView key={article.id} article={article} images={imagesOf(article.id)} videoUrl={videoUrlByArticleId.get(article.id) ?? null} />
          ))}

          {childrenOf(category.id).map((sub) => (
            <div key={sub.id} className="flex flex-col gap-4 border-l pl-4">
              <h3 className="font-medium">{sub.name}</h3>
              {articlesOf(sub.id).map((article) => (
                <ArticleView
                  key={article.id}
                  article={article}
                  images={imagesOf(article.id)}
                  videoUrl={videoUrlByArticleId.get(article.id) ?? null}
                />
              ))}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

function ArticleView({
  article,
  images,
  videoUrl,
}: {
  article: Article;
  images: (ImageRow & { url: string | null })[];
  videoUrl: string | null;
}) {
  return (
    <article className="flex flex-col gap-3">
      <h4 className="font-medium">{article.title}</h4>
      <div className="flex flex-col gap-2 text-sm whitespace-pre-wrap">{article.body}</div>
      {images.length > 0 && (
        <div className="flex flex-col gap-3">
          {images.map((img) =>
            img.url ? (
              <figure key={img.id} className="flex flex-col gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element -- signed Storage URL, not an optimizable static asset */}
                <img src={img.url} alt={img.caption ?? article.title} className="max-w-full rounded-md border" />
                {img.caption && <figcaption className="text-muted-foreground text-xs">{img.caption}</figcaption>}
              </figure>
            ) : null,
          )}
        </div>
      )}
      {videoUrl && <video controls src={videoUrl} className="max-w-full rounded-md border" />}
    </article>
  );
}
