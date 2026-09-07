"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CategoryPicker } from "@/components/kb/category-picker";
import { createClient } from "@/lib/supabase/client";
import { humanize } from "@/lib/format/text";
import { resubmitArticle, submitArticle, type KbArticleRow } from "@/lib/kb/actions";
import type { CurrentUser } from "@/lib/auth/current-user";
import type { Database } from "@/lib/supabase/database.types";

type Category = Database["public"]["Tables"]["kb_categories"]["Row"];
type Manufacturer = Database["public"]["Tables"]["kb_manufacturers"]["Row"];
type ModelRange = Database["public"]["Tables"]["kb_model_ranges"]["Row"];
type ArticleListRow = Pick<KbArticleRow, "id" | "title" | "status" | "created_at" | "tags"> & {
  category: { name: string } | null;
  manufacturer: { name: string } | null;
  model_range: { name: string } | null;
};
type ArticleDetailRow = KbArticleRow & {
  category: { name: string } | null;
  manufacturer: { name: string } | null;
  model_range: { name: string } | null;
};
type Attachment = { id: string; filename: string; url: string | null };

type View =
  | { screen: "browse" }
  | { screen: "article"; articleId: string }
  | { screen: "submit" }
  | { screen: "resubmit"; article: ArticleDetailRow };

function subscribeToOnlineStatus(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}
function getOnlineSnapshot() {
  return navigator.onLine;
}
/** SSR has no navigator — "online" is the safe default, corrected immediately on hydration (same pattern as install-prompt.tsx's useIsStandalone/useIsIOS). */
function getServerOnlineSnapshot() {
  return true;
}
function useIsOnline(): boolean {
  return useSyncExternalStore(subscribeToOnlineStatus, getOnlineSnapshot, getServerOnlineSnapshot);
}

function breadcrumb(article: { category: { name: string } | null; manufacturer: { name: string } | null; model_range: { name: string } | null }) {
  return [article.category?.name, article.manufacturer?.name, article.model_range?.name].filter(Boolean).join(" > ") || "Uncategorized";
}

/**
 * Knowledge Base is online-only for v1 (confirmed proposal, decision #4) —
 * unlike every other field-app screen, this one does NOT go through Dexie
 * or the offline outbox. It queries Supabase directly and shows a plain
 * "needs a connection" message when offline, per that decision, rather
 * than the caching/sync machinery the rest of the app uses.
 */
export function KnowledgeBaseView({ currentUser, onBack }: { currentUser: CurrentUser; onBack: () => void }) {
  const [view, setView] = useState<View>({ screen: "browse" });
  const isOnline = useIsOnline();

  if (!isOnline) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <button type="button" onClick={onBack} className="text-muted-foreground text-sm underline">
          ← Back
        </button>
        <p className="text-muted-foreground text-sm">You&apos;re offline — Knowledge Base needs a connection.</p>
      </div>
    );
  }

  if (view.screen === "article") {
    return (
      <ArticleScreen
        articleId={view.articleId}
        onBack={() => setView({ screen: "browse" })}
        onResubmit={(article) => setView({ screen: "resubmit", article })}
      />
    );
  }
  if (view.screen === "submit") {
    return <SubmitScreen onBack={() => setView({ screen: "browse" })} onDone={() => setView({ screen: "browse" })} />;
  }
  if (view.screen === "resubmit") {
    return (
      <SubmitScreen
        existing={view.article}
        onBack={() => setView({ screen: "browse" })}
        onDone={() => setView({ screen: "browse" })}
      />
    );
  }
  return (
    <BrowseScreen
      currentUser={currentUser}
      onBack={onBack}
      onOpenArticle={(articleId) => setView({ screen: "article", articleId })}
      onWrite={() => setView({ screen: "submit" })}
    />
  );
}

function BrowseScreen({
  currentUser,
  onBack,
  onOpenArticle,
  onWrite,
}: {
  currentUser: CurrentUser;
  onBack: () => void;
  onOpenArticle: (articleId: string) => void;
  onWrite: () => void;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [modelRanges, setModelRanges] = useState<ModelRange[]>([]);
  const [articles, setArticles] = useState<ArticleListRow[] | null>(null);
  const [mine, setMine] = useState<ArticleListRow[] | null>(null);
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [manufacturerId, setManufacturerId] = useState("");
  const [modelRangeId, setModelRangeId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const ARTICLE_LIST_SELECT = "id, title, status, created_at, tags, category:kb_categories(name), manufacturer:kb_manufacturers(name), model_range:kb_model_ranges(name)";

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("kb_categories")
      .select("*")
      .order("name")
      .then(({ data }) => setCategories(data ?? []));
    supabase
      .from("kb_manufacturers")
      .select("*")
      .order("name")
      .then(({ data }) => setManufacturers(data ?? []));
    supabase
      .from("kb_model_ranges")
      .select("*")
      .order("name")
      .then(({ data }) => setModelRanges(data ?? []));
    supabase
      .from("kb_articles")
      .select(ARTICLE_LIST_SELECT)
      .eq("author_id", currentUser.id)
      .neq("status", "published")
      .order("created_at", { ascending: false })
      .then(({ data }) => setMine((data as ArticleListRow[] | null) ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let query = supabase
      .from("kb_articles")
      .select(ARTICLE_LIST_SELECT)
      .eq("status", "published")
      .order("created_at", { ascending: false });
    if (categoryId) query = query.eq("category_id", categoryId);
    if (manufacturerId) query = query.eq("manufacturer_id", manufacturerId);
    if (modelRangeId) query = query.eq("model_range_id", modelRangeId);
    if (q.trim()) query = query.ilike("title", `%${q.trim()}%`);
    query.then(({ data, error: err }) => {
      if (err) setError(err.message);
      else setArticles((data as ArticleListRow[] | null) ?? []);
    });
  }, [q, categoryId, manufacturerId, modelRangeId]);

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <button type="button" onClick={onBack} className="text-muted-foreground text-sm underline">
        ← Back
      </button>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Knowledge Base</h1>
        <Button type="button" size="sm" onClick={onWrite}>
          Write article
        </Button>
      </div>

      {mine && mine.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">My submissions</p>
          <ul className="flex flex-col gap-2">
            {mine.map((a) => (
              <ArticleRow key={a.id} article={a} onOpen={() => onOpenArticle(a.id)} />
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-muted-foreground text-xs">Search</label>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
        />
      </div>
      <CategoryPicker
        categories={categories}
        manufacturers={manufacturers}
        modelRanges={modelRanges}
        categoryId={categoryId}
        manufacturerId={manufacturerId}
        modelRangeId={modelRangeId}
        onCategoryChange={setCategoryId}
        onManufacturerChange={setManufacturerId}
        onModelRangeChange={setModelRangeId}
        categoryRequired={false}
      />

      {error && <p className="text-destructive text-sm">{error}</p>}
      {articles === null ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : articles.length === 0 ? (
        <p className="text-muted-foreground text-sm">No articles found.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {articles.map((a) => (
            <ArticleRow key={a.id} article={a} onOpen={() => onOpenArticle(a.id)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ArticleRow({ article, onOpen }: { article: ArticleListRow; onOpen: () => void }) {
  return (
    <li>
      <button type="button" onClick={onOpen} className="w-full rounded-md border p-3 text-left">
        <div className="flex items-center justify-between">
          <span className="font-medium">{article.title}</span>
          {article.status !== "published" && <Badge variant="outline">{humanize(article.status)}</Badge>}
        </div>
        <p className="text-muted-foreground text-sm">
          {breadcrumb(article)}
          {article.tags.length > 0 && ` · ${article.tags.join(", ")}`}
        </p>
      </button>
    </li>
  );
}

function ArticleScreen({
  articleId,
  onBack,
  onResubmit,
}: {
  articleId: string;
  onBack: () => void;
  onResubmit: (article: ArticleDetailRow) => void;
}) {
  const [article, setArticle] = useState<ArticleDetailRow | null | undefined>(undefined);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("kb_articles")
      .select("*, category:kb_categories(name), manufacturer:kb_manufacturers(name), model_range:kb_model_ranges(name)")
      .eq("id", articleId)
      .single()
      .then(({ data }) => setArticle((data as ArticleDetailRow | null) ?? null));
    supabase
      .from("kb_article_attachments")
      .select("id, filename, storage_path")
      .eq("article_id", articleId)
      .then(async ({ data }) => {
        const rows = data ?? [];
        const withUrls = await Promise.all(
          rows.map(async (a) => {
            const { data: signed } = await supabase.storage.from("kb-attachments").createSignedUrl(a.storage_path, 3600);
            return { id: a.id, filename: a.filename, url: signed?.signedUrl ?? null };
          }),
        );
        setAttachments(withUrls);
      });
  }, [articleId]);

  if (article === undefined) {
    return <p className="text-muted-foreground p-4 text-sm">Loading…</p>;
  }
  if (!article) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <button type="button" onClick={onBack} className="text-muted-foreground text-sm underline">
          ← Back
        </button>
        <p className="text-muted-foreground text-sm">Article not found.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <button type="button" onClick={onBack} className="text-muted-foreground text-sm underline">
        ← Back
      </button>
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">{article.title}</h1>
          {article.status !== "published" && <Badge variant="outline">{humanize(article.status)}</Badge>}
        </div>
        <p className="text-muted-foreground text-sm">
          {breadcrumb(article)}
          {article.tags.length > 0 && ` · ${article.tags.join(", ")}`}
        </p>
      </div>

      {article.status === "declined" && (
        <div className="rounded-md border p-3">
          {article.decline_reason && <p className="text-destructive text-sm">Declined: {article.decline_reason}</p>}
          <Button type="button" size="sm" className="mt-2" onClick={() => onResubmit(article)}>
            Revise &amp; resubmit
          </Button>
        </div>
      )}

      <div className="max-w-2xl whitespace-pre-wrap text-sm">{article.body}</div>

      {attachments.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">Attachments</p>
          <ul className="flex flex-col gap-1">
            {attachments.map((a) => (
              <li key={a.id} className="text-sm">
                {a.url ? (
                  <a href={a.url} target="_blank" rel="noreferrer" className="underline">
                    {a.filename}
                  </a>
                ) : (
                  a.filename
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SubmitScreen({
  existing,
  onBack,
  onDone,
}: {
  existing?: ArticleDetailRow;
  onBack: () => void;
  onDone: () => void;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [modelRanges, setModelRanges] = useState<ModelRange[]>([]);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [categoryId, setCategoryId] = useState(existing?.category_id ?? "");
  const [manufacturerId, setManufacturerId] = useState(existing?.manufacturer_id ?? "");
  const [modelRangeId, setModelRangeId] = useState(existing?.model_range_id ?? "");
  const [tags, setTags] = useState(existing?.tags.join(", ") ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("kb_categories")
      .select("*")
      .order("name")
      .then(({ data }) => setCategories(data ?? []));
    supabase
      .from("kb_manufacturers")
      .select("*")
      .order("name")
      .then(({ data }) => setManufacturers(data ?? []));
    supabase
      .from("kb_model_ranges")
      .select("*")
      .order("name")
      .then(({ data }) => setModelRanges(data ?? []));
  }, []);

  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      const input = { title, body, categoryId, manufacturerId, modelRangeId, tags };
      const result = existing ? await resubmitArticle(existing.id, input) : await submitArticle(input);
      if (result.ok) onDone();
      else setMessage(result.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <button type="button" onClick={onBack} className="text-muted-foreground text-sm underline">
        ← Back
      </button>
      <h1 className="text-lg font-semibold">{existing ? "Revise & resubmit" : "Write article"}</h1>
      <p className="text-muted-foreground text-sm">Goes to office for review before it&apos;s published.</p>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Title</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
        />
      </label>
      <CategoryPicker
        categories={categories}
        manufacturers={manufacturers}
        modelRanges={modelRanges}
        categoryId={categoryId}
        manufacturerId={manufacturerId}
        modelRangeId={modelRangeId}
        onCategoryChange={setCategoryId}
        onManufacturerChange={setManufacturerId}
        onModelRangeChange={setModelRangeId}
      />
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Tags (comma-separated)</span>
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Body</span>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} />
      </label>

      {message && <p className="text-destructive text-sm">{message}</p>}
      <Button
        type="button"
        disabled={isSubmitting || !title.trim() || !body.trim() || !categoryId}
        onClick={handleSubmit}
      >
        {isSubmitting ? "Submitting…" : "Submit for review"}
      </Button>
    </div>
  );
}
