"use client";

import { useRef, useState } from "react";
import type { MediaQueueItem } from "@/lib/offline/db";
import { enqueueMedia } from "@/lib/offline/media-capture";

export function PhotoSlot({
  jobId,
  slot,
  label,
  capturedBy,
  item,
  onCaptured,
}: {
  jobId: string;
  slot: string;
  label: string;
  capturedBy: string;
  item: MediaQueueItem | undefined;
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
    } finally {
      setIsSaving(false);
    }
  }

  const captured = !!item;
  const icon = isSaving ? "…" : item?.kind === "video" ? "🎥" : captured ? "✅" : "📷";

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isSaving}
        className={`flex h-20 w-20 items-center justify-center rounded-md border text-2xl ${
          captured ? "border-green-600 bg-green-50" : "border-dashed"
        }`}
        aria-label={`Capture photo or video: ${label}`}
      >
        {icon}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        className="hidden"
        onChange={handleChange}
      />
      <span className="text-center text-xs">{label}</span>
      {error && <span className="text-destructive max-w-20 text-center text-xs">{error}</span>}
    </div>
  );
}
