"use client";

import { useRef, useState } from "react";
import type { MediaQueueItem } from "@/lib/offline/db";
import { enqueuePhoto } from "@/lib/offline/media-capture";

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

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setIsSaving(true);
    try {
      await enqueuePhoto({ jobId, slot, file, capturedBy });
      onCaptured?.();
    } finally {
      setIsSaving(false);
    }
  }

  const captured = !!item;

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isSaving}
        className={`flex h-20 w-20 items-center justify-center rounded-md border text-2xl ${
          captured ? "border-green-600 bg-green-50" : "border-dashed"
        }`}
        aria-label={`Capture photo: ${label}`}
      >
        {isSaving ? "…" : captured ? "✅" : "📷"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleChange}
      />
      <span className="text-center text-xs">{label}</span>
    </div>
  );
}
