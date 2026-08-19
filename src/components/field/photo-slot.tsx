"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MediaQueueItem } from "@/lib/offline/db";
import { enqueueMedia } from "@/lib/offline/media-capture";

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

  const captured = items.length > 0;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex flex-wrap items-center justify-center gap-1">
        {items.map((item) => (
          <Thumbnail key={item.id} item={item} />
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
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        className="hidden"
        onChange={handleChange}
      />
      <span className="text-center text-xs">
        {label}
        {items.length > 0 && ` (${items.length})`}
      </span>
      {error && <span className="text-destructive max-w-20 text-center text-xs">{error}</span>}
    </div>
  );
}

function Thumbnail({ item }: { item: MediaQueueItem }) {
  const url = useMemo(() => URL.createObjectURL(item.blob), [item.blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  if (item.kind === "video") {
    return (
      <div className="flex h-20 w-20 items-center justify-center rounded-md border border-green-600 bg-green-50 text-2xl">
        🎥
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- local blob: URL, next/image can't optimize it
    <img src={url} alt="" className="h-20 w-20 rounded-md border border-green-600 object-cover" />
  );
}
