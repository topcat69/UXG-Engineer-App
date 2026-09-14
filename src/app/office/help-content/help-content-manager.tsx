"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { humanize } from "@/lib/format/text";
import type { Database } from "@/lib/supabase/database.types";
import {
  createHelpArticle,
  createHelpCategory,
  deleteHelpArticle,
  deleteHelpArticleImage,
  deleteHelpArticleVideo,
  deleteHelpCategory,
  updateHelpArticle,
  updateHelpCategory,
  uploadHelpArticleImage,
  uploadHelpArticleVideo,
} from "./actions";

type UserRole = Database["public"]["Enums"]["user_role"];
const ROLES: UserRole[] = ["superadmin", "manager", "engineer", "warehouse", "finance"];

type Category = { id: string; parent_id: string | null; name: string; position: number; role: UserRole | null };
type Article = { id: string; category_id: string; title: string; body: string; video_path: string | null; videoUrl: string | null };
type ImageRow = { id: string; article_id: string; storage_path: string; caption: string | null; url: string | null };

function roleLabel(role: UserRole | null): string {
  return role ? humanize(role) : "Shared (everyone)";
}

export function HelpContentManager({ categories, articles, images }: { categories: Category[]; articles: Article[]; images: ImageRow[] }) {
  const router = useRouter();
  const [showAddTopLevel, setShowAddTopLevel] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const topLevel = categories.filter((c) => !c.parent_id);
  const childrenOf = (parentId: string) => categories.filter((c) => c.parent_id === parentId);
  const articlesOf = (categoryId: string) => articles.filter((a) => a.category_id === categoryId);
  const imagesOf = (articleId: string) => images.filter((i) => i.article_id === articleId);

  function handleAddTopLevel() {
    startTransition(async () => {
      const result = await createHelpCategory(newName, (newRole || null) as UserRole | null, null);
      if (result.ok) {
        setNewName("");
        setNewRole("");
        setShowAddTopLevel(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {topLevel.map((category) => (
        <CategorySection
          key={category.id}
          category={category}
          childCategories={childrenOf(category.id)}
          articlesOf={articlesOf}
          imagesOf={imagesOf}
        />
      ))}

      {showAddTopLevel ? (
        <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
          <div className="flex flex-col gap-1">
            <label className="text-muted-foreground text-xs">Guide name</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Engineer Guide"
              className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-muted-foreground text-xs">Role</label>
            <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="border-input h-9 rounded-md border bg-transparent px-2 text-sm">
              <option value="">Shared (everyone)</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {humanize(r)}
                </option>
              ))}
            </select>
          </div>
          <Button type="button" size="sm" disabled={isPending || !newName.trim()} onClick={handleAddTopLevel}>
            Add
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setShowAddTopLevel(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button type="button" size="sm" onClick={() => setShowAddTopLevel(true)}>
          New guide
        </Button>
      )}
    </div>
  );
}

function CategorySection({
  category,
  childCategories,
  articlesOf,
  imagesOf,
}: {
  category: Category;
  childCategories: Category[];
  articlesOf: (categoryId: string) => Article[];
  imagesOf: (articleId: string) => ImageRow[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [role, setRole] = useState<string>(category.role ?? "");
  const [showAddSub, setShowAddSub] = useState(false);
  const [subName, setSubName] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await updateHelpCategory(category.id, name, (role || null) as UserRole | null);
      if (result.ok) {
        setEditing(false);
        router.refresh();
      }
    });
  }

  function handleDelete() {
    if (!window.confirm(`Delete "${category.name}"? This removes every subcategory, article, and image under it — permanently.`)) return;
    startTransition(async () => {
      const result = await deleteHelpCategory(category.id);
      if (result.ok) router.refresh();
    });
  }

  function handleAddSub() {
    startTransition(async () => {
      const result = await createHelpCategory(subName, null, category.id);
      if (result.ok) {
        setSubName("");
        setShowAddSub(false);
        router.refresh();
      }
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-md border p-4">
      {editing ? (
        <div className="flex flex-wrap items-end gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} className="border-input h-9 rounded-md border bg-transparent px-2 text-sm" />
          <select value={role} onChange={(e) => setRole(e.target.value)} className="border-input h-9 rounded-md border bg-transparent px-2 text-sm">
            <option value="">Shared (everyone)</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {humanize(r)}
              </option>
            ))}
          </select>
          <Button type="button" size="sm" disabled={isPending} onClick={handleSave}>
            Save
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <h2 className="font-medium">
            {category.name} <span className="text-muted-foreground text-xs">— {roleLabel(category.role)}</span>
          </h2>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
              Rename
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </div>
      )}

      <ArticleList categoryId={category.id} articles={articlesOf(category.id)} imagesOf={imagesOf} />

      {childCategories.map((sub) => (
        <div key={sub.id} className="flex flex-col gap-3 border-l pl-4">
          <SubcategoryHeader category={sub} />
          <ArticleList categoryId={sub.id} articles={articlesOf(sub.id)} imagesOf={imagesOf} />
        </div>
      ))}

      {showAddSub ? (
        <div className="flex items-end gap-2">
          <input
            value={subName}
            onChange={(e) => setSubName(e.target.value)}
            placeholder="Subcategory name"
            className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
          />
          <Button type="button" size="sm" disabled={isPending || !subName.trim()} onClick={handleAddSub}>
            Add
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setShowAddSub(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={() => setShowAddSub(true)}>
          New subcategory
        </Button>
      )}
    </section>
  );
}

function SubcategoryHeader({ category }: { category: Category }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await updateHelpCategory(category.id, name, category.role);
      if (result.ok) {
        setEditing(false);
        router.refresh();
      }
    });
  }

  function handleDelete() {
    if (!window.confirm(`Delete "${category.name}"? This removes every article and image under it — permanently.`)) return;
    startTransition(async () => {
      const result = await deleteHelpCategory(category.id);
      if (result.ok) router.refresh();
    });
  }

  return editing ? (
    <div className="flex items-end gap-2">
      <input value={name} onChange={(e) => setName(e.target.value)} className="border-input h-9 rounded-md border bg-transparent px-2 text-sm" />
      <Button type="button" size="sm" disabled={isPending} onClick={handleSave}>
        Save
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
        Cancel
      </Button>
    </div>
  ) : (
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-medium">{category.name}</h3>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
          Rename
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={handleDelete}>
          Delete
        </Button>
      </div>
    </div>
  );
}

function ArticleList({ categoryId, articles, imagesOf }: { categoryId: string; articles: Article[]; imagesOf: (articleId: string) => ImageRow[] }) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    startTransition(async () => {
      const result = await createHelpArticle(categoryId, title, body);
      if (result.ok) {
        setTitle("");
        setBody("");
        setShowAdd(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {articles.map((article) => (
        <ArticleEditor key={article.id} article={article} images={imagesOf(article.id)} />
      ))}

      {showAdd ? (
        <div className="flex flex-col gap-2 rounded-md border bg-muted/40 p-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Article title"
            className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="Step-by-step text — refer to real button/label text so this stays correct even if the layout shifts."
            className="border-input rounded-md border bg-transparent px-2 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={isPending || !title.trim()} onClick={handleAdd}>
              Add article
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={() => setShowAdd(true)}>
          New article
        </Button>
      )}
    </div>
  );
}

function ArticleEditor({ article, images }: { article: Article; images: ImageRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(article.title);
  const [body, setBody] = useState(article.body);
  const [caption, setCaption] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await updateHelpArticle(article.id, title, body);
      if (result.ok) {
        setEditing(false);
        router.refresh();
      }
    });
  }

  function handleDelete() {
    if (!window.confirm(`Delete "${article.title}"? This removes its images and video too — permanently.`)) return;
    startTransition(async () => {
      const result = await deleteHelpArticle(article.id);
      if (result.ok) router.refresh();
    });
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.set("file", file);
    formData.set("caption", caption);
    startTransition(async () => {
      const result = await uploadHelpArticleImage(article.id, formData);
      if (result.ok) {
        setCaption("");
        router.refresh();
      } else {
        setMessage(result.message);
      }
    });
    e.target.value = "";
  }

  function handleDeleteImage(image: ImageRow) {
    startTransition(async () => {
      const result = await deleteHelpArticleImage(image.id, image.storage_path);
      if (result.ok) router.refresh();
    });
  }

  function handleVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      const result = await uploadHelpArticleVideo(article.id, formData);
      if (!result.ok) setMessage(result.message);
      router.refresh();
    });
    e.target.value = "";
  }

  function handleDeleteVideo() {
    if (!article.video_path) return;
    startTransition(async () => {
      await deleteHelpArticleVideo(article.id, article.video_path!);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      {editing ? (
        <>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="border-input h-9 rounded-md border bg-transparent px-2 text-sm" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} className="border-input rounded-md border bg-transparent px-2 py-1.5 text-sm" />
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={isPending} onClick={handleSave}>
              Save
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h4 className="font-medium">{article.title}</h4>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={handleDelete}>
                Delete
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground text-sm whitespace-pre-wrap">{article.body || "—"}</p>
        </>
      )}

      <div className="flex flex-wrap gap-3">
        {images.map((img) => (
          <div key={img.id} className="flex flex-col gap-1">
            {img.url && (
              // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL thumbnail
              <img src={img.url} alt={img.caption ?? article.title} className="h-20 w-auto rounded border object-cover" />
            )}
            <button type="button" onClick={() => handleDeleteImage(img)} className="text-destructive text-xs underline">
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption (optional)" className="border-input h-9 rounded-md border bg-transparent px-2 text-sm" />
        <label className="border-input inline-flex h-9 cursor-pointer items-center rounded-md border px-3 text-sm hover:bg-accent">
          Add image
          <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={isPending} />
        </label>

        {article.videoUrl ? (
          <div className="flex items-center gap-2">
            <video src={article.videoUrl} controls className="h-9 w-auto rounded border" />
            <button type="button" onClick={handleDeleteVideo} className="text-destructive text-xs underline">
              Remove video
            </button>
          </div>
        ) : (
          <label className="border-input inline-flex h-9 cursor-pointer items-center rounded-md border px-3 text-sm hover:bg-accent">
            Add video
            <input type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" disabled={isPending} />
          </label>
        )}
      </div>
      {message && <p className="text-destructive text-xs">{message}</p>}
    </div>
  );
}
