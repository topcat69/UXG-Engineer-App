"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CategoryPicker } from "@/components/kb/category-picker";
import { createArticle, type KbCategoryRow, type KbManufacturerRow, type KbModelRangeRow } from "./actions";

export function CreateArticleForm({
  categories,
  manufacturers,
  modelRanges,
}: {
  categories: KbCategoryRow[];
  manufacturers: KbManufacturerRow[];
  modelRanges: KbModelRangeRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [manufacturerId, setManufacturerId] = useState("");
  const [modelRangeId, setModelRangeId] = useState("");
  const [tags, setTags] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    startTransition(async () => {
      const result = await createArticle({ title, body, categoryId, manufacturerId, modelRangeId, tags });
      if (result.ok) {
        router.push(`/office/knowledge-base/${result.article.id}`);
      } else {
        setMessage(result.message);
      }
    });
  }

  if (!open) {
    return (
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        Write article
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border bg-muted/40 p-3">
      <div className="flex flex-col gap-1">
        <label className="text-muted-foreground text-xs">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
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
      />
      <div className="flex flex-col gap-1">
        <label className="text-muted-foreground text-xs">Tags (comma-separated)</label>
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="wiring, screens"
          className="border-input h-9 w-64 rounded-md border bg-transparent px-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-muted-foreground text-xs">Body</label>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} />
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={isPending || !title.trim() || !body.trim() || !categoryId}
          onClick={handleCreate}
        >
          {isPending ? "Publishing…" : "Publish"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Attachments (PDF/video) can be added once the article&apos;s created.
      </p>
      {message && <p className="text-destructive text-sm">{message}</p>}
    </div>
  );
}
