import { createClient } from "@/lib/supabase/server";
import { HelpContentManager } from "./help-content-manager";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Authoring for the Help Guides (/help) — superadmin and manager both see
 * and edit every guide, regardless of which role it's for; see the RLS
 * select policies in 20260915000000_help_guides.sql for why.
 */
export default async function HelpContentPage() {
  const supabase = await createClient();

  const [{ data: categories, error }, { data: articles }, { data: images }] = await Promise.all([
    supabase.from("help_categories").select("id, parent_id, name, position, role").order("position").order("name"),
    supabase
      .from("help_articles")
      .select("id, category_id, title, body, video_path, position")
      .order("position"),
    supabase.from("help_article_images").select("id, article_id, storage_path, caption, position").order("position"),
  ]);

  if (error) {
    return <p className="text-destructive">Failed to load Help Content: {error.message}</p>;
  }

  const imagesWithUrls = await Promise.all(
    (images ?? []).map(async (img) => {
      const { data } = await supabase.storage.from("help-media").createSignedUrl(img.storage_path, SIGNED_URL_TTL_SECONDS);
      return { ...img, url: data?.signedUrl ?? null };
    }),
  );
  const articlesWithVideoUrls = await Promise.all(
    (articles ?? []).map(async (a) => {
      if (!a.video_path) return { ...a, videoUrl: null };
      const { data } = await supabase.storage.from("help-media").createSignedUrl(a.video_path, SIGNED_URL_TTL_SECONDS);
      return { ...a, videoUrl: data?.signedUrl ?? null };
    }),
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Help Content</h1>
        <p className="text-muted-foreground text-sm">
          Authoring for the role-based guides shown at /help. Each top-level category belongs to one role (or
          &quot;Shared&quot;, visible to everyone) — subcategories always inherit their parent&apos;s role.
        </p>
      </div>
      <HelpContentManager categories={categories ?? []} articles={articlesWithVideoUrls} images={imagesWithUrls} />
    </div>
  );
}
