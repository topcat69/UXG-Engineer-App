"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { humanize } from "@/lib/format/text";
import {
  approveArticle,
  declineArticle,
  deleteArticle,
  deleteAttachment,
  updateArticle,
  uploadAttachment,
  type KbArticleRow,
  type KbAttachmentRow,
  type KbCategoryRow,
} from "../actions";

type ArticleWithJoins = KbArticleRow & {
  category: { id: string; name: string } | null;
  author: { name: string } | null;
  reviewer: { name: string } | null;
};

function statusVariant(status: string): "secondary" | "outline" | "destructive" {
  if (status === "pending_review") return "outline";
  if (status === "declined") return "destructive";
  return "secondary";
}

export function ArticleDetail({
  article,
  categories,
  attachments: initialAttachments,
}: {
  article: ArticleWithJoins;
  categories: KbCategoryRow[];
  attachments: (KbAttachmentRow & { url: string | null })[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(article.title);
  const [body, setBody] = useState(article.body);
  const [categoryId, setCategoryId] = useState(article.category_id);
  const [tags, setTags] = useState(article.tags.join(", "));
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [declining, setDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  const [attachments, setAttachments] = useState(initialAttachments);
  const [isUploading, startUpload] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleSaveEdit() {
    startTransition(async () => {
      const result = await updateArticle(article.id, { title, body, categoryId, tags });
      if (result.ok) {
        setEditing(false);
        router.refresh();
      } else {
        setMessage(result.message);
      }
    });
  }

  function handleApprove() {
    startTransition(async () => {
      const result = await approveArticle(article.id);
      if (result.ok) router.refresh();
      else setMessage(result.message);
    });
  }

  function handleDecline() {
    if (!declineReason.trim()) return;
    startTransition(async () => {
      const result = await declineArticle(article.id, declineReason);
      if (result.ok) {
        setDeclining(false);
        setDeclineReason("");
        router.refresh();
      } else {
        setMessage(result.message);
      }
    });
  }

  function handleDelete() {
    if (!window.confirm(`Delete "${article.title}"? This can't be undone.`)) return;
    startTransition(async () => {
      const result = await deleteArticle(article.id);
      if (result.ok) router.push("/office/knowledge-base");
      else setMessage(result.message);
    });
  }

  function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.set("file", file);
    startUpload(async () => {
      const result = await uploadAttachment(article.id, formData);
      if (result.ok) {
        setAttachments((prev) => [...prev, { ...result.attachment, url: null }]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        router.refresh();
      } else {
        setMessage(result.message);
      }
    });
  }

  function handleDeleteAttachment(attachmentId: string, storagePath: string) {
    startUpload(async () => {
      const result = await deleteAttachment(attachmentId, article.id, storagePath);
      if (result.ok) setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      else setMessage(result.message);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{article.title}</h1>
            <Badge variant={statusVariant(article.status)}>{humanize(article.status)}</Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            {article.category?.name ?? "Uncategorized"} · by {article.author?.name ?? "Unknown"}
            {article.tags.length > 0 && ` · ${article.tags.join(", ")}`}
          </p>
          {article.status === "declined" && article.decline_reason && (
            <p className="text-destructive text-sm">Declined: {article.decline_reason}</p>
          )}
          {article.reviewer?.name && article.reviewed_at && (
            <p className="text-muted-foreground text-xs">
              Reviewed by {article.reviewer.name} on {new Date(article.reviewed_at).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {article.status === "pending_review" && (
            <Button type="button" size="sm" disabled={isPending} onClick={handleApprove}>
              Approve &amp; publish
            </Button>
          )}
          {article.status === "pending_review" && !declining && (
            <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => setDeclining(true)}>
              Decline
            </Button>
          )}
          <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => setEditing((v) => !v)}>
            {editing ? "Cancel" : "Edit"}
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </div>

      {declining && (
        <div className="flex flex-col gap-2 rounded-md border bg-muted/40 p-3">
          <label className="text-muted-foreground text-xs">Reason for declining (shown to the author)</label>
          <Textarea value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} rows={3} />
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={isPending || !declineReason.trim()} onClick={handleDecline}>
              Confirm decline
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setDeclining(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {editing ? (
        <div className="flex flex-col gap-3 rounded-md border p-3">
          <div className="flex flex-col gap-1">
            <label className="text-muted-foreground text-xs">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
            />
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">Tags (comma-separated)</label>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="border-input h-9 w-64 rounded-md border bg-transparent px-2 text-sm"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-muted-foreground text-xs">Body</label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} />
          </div>
          <Button
            type="button"
            size="sm"
            disabled={isPending || !title.trim() || !body.trim() || !categoryId}
            onClick={handleSaveEdit}
            className="self-start"
          >
            Save
          </Button>
        </div>
      ) : (
        <div className="max-w-2xl whitespace-pre-wrap text-sm">{article.body}</div>
      )}

      {message && <p className="text-destructive text-sm">{message}</p>}

      <section className="flex flex-col gap-2 rounded-md border p-3">
        <h2 className="font-medium">Attachments</h2>
        {attachments.length > 0 && (
          <ul className="flex flex-col gap-1">
            {attachments.map((a) => (
              <li key={a.id} className="flex items-center gap-2 text-sm">
                {a.url ? (
                  <a href={a.url} target="_blank" rel="noreferrer" className="underline">
                    {a.filename}
                  </a>
                ) : (
                  <span>{a.filename}</span>
                )}
                <button
                  type="button"
                  onClick={() => handleDeleteAttachment(a.id, a.storage_path)}
                  disabled={isUploading}
                  className="text-destructive text-xs underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept="application/pdf,video/*" className="text-sm" />
          <Button type="button" size="sm" variant="outline" disabled={isUploading} onClick={handleUpload}>
            {isUploading ? "Uploading…" : "Upload"}
          </Button>
        </div>
      </section>
    </div>
  );
}
