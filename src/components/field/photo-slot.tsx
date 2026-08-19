"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MediaQueueItem } from "@/lib/offline/db";
import { deleteMediaItem, enqueueMedia } from "@/lib/offline/media-capture";

/**
 * Renders every captured item for one slot as a thumbnail row, plus an
 * always-available "add" tile — slots aren't capped at one photo (schema
 * has no unique(job_id, slot) constraint; multiple media_assets rows per
 * slot were always supported server-side, the field UI just only ever
 * showed the latest one). Engineers tap "add" as many times as the job
 * needs — e.g. several "equipment in situ" shots for a multi-screen site.
 */
export function PhotoSlot({
  jobId,
  slot,
  label,
  capturedBy,
  items,
  onCaptured,
}: {
  jobId: string;
  slot: string;
  label: string;
  capturedBy: string;
  items: MediaQueueItem[];
  onCaptured?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<MediaQueueItem | null>(null);

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setIsSaving(true);
    setError(null);
    try {
      const result = await enqueueMedia({ jobId, slot, file, capturedBy });
      if (result.ok) {
        onCaptured?.();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong saving this — please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(item: MediaQueueItem) {
    if (!confirm("Delete this photo?")) return;
    await deleteMediaItem(item.id);
    onCaptured?.();
  }

  const captured = items.length > 0;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex flex-wrap items-center justify-center gap-1">
        {items.map((item) => (
          <Thumbnail key={item.id} item={item} onView={() => setPreviewItem(item)} onDelete={() => handleDelete(item)} />
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isSaving}
          className={`flex h-20 w-20 items-center justify-center rounded-md border text-2xl ${
            captured ? "border-green-600 bg-green-50" : "border-dashed"
          }`}
          aria-label={captured ? `Add another photo or video: ${label}` : `Capture photo or video: ${label}`}
        >
          {isSaving ? "…" : captured ? "＋" : "📷"}
        </button>
      </div>
      {/* No `capture` attribute — leaving it off lets the mobile picker offer
          both "Take photo" and "Photo library" instead of forcing straight
          into the camera, per the request to allow picking an existing shot. */}
      <input ref={inputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleChange} />
      <span className="text-center text-xs">
        {label}
        {items.length > 0 && ` (${items.length})`}
      </span>
      {error && <span className="text-destructive max-w-20 text-center text-xs">{error}</span>}
      {previewItem && <PhotoPreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />}
    </div>
  );
}

function Thumbnail({
  item,
  onView,
  onDelete,
}: {
  item: MediaQueueItem;
  onView: () => void;
  onDelete: () => void;
}) {
  const url = useMemo(() => URL.createObjectURL(item.blob), [item.blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  return (
    <div className="relative h-20 w-20">
      <button
        type="button"
        onClick={onView}
        className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-md border border-green-600 bg-green-50 text-2xl"
        aria-label="View photo"
      >
        {item.kind === "video" ? (
          "🎥"
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- local blob: URL, next/image can't optimize it
          <img src={url} alt="" className="h-full w-full object-cover" />
        )}
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete photo"
        className="bg-destructive absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full text-xs text-white shadow"
      >
        ✕
      </button>
    </div>
  );
}

function PhotoPreviewModal({ item, onClose }: { item: MediaQueueItem; onClose: () => void }) {
  const url = useMemo(() => URL.createObjectURL(item.blob), [item.blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/90 p-4" onClick={onClose}>
      {item.kind === "video" ? (
        <video src={url} controls autoPlay className="max-h-[80vh] max-w-full rounded-md" onClick={(e) => e.stopPropagation()} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- local blob: URL, next/image can't optimize it
        <img src={url} alt="" className="max-h-[80vh] max-w-full rounded-md object-contain" onClick={(e) => e.stopPropagation()} />
      )}
      <button type="button" onClick={onClose} className="rounded-md bg-white px-4 py-2 text-sm font-medium">
        Close
      </button>
    </div>
  );
}
