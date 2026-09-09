"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { uploadStockItemPhoto, deleteStockItemPhoto } from "./actions";

export function StockItemPhotoControl({
  stockItemId,
  jobSheetId,
  imagePath,
  imageUrl,
}: {
  stockItemId: string;
  jobSheetId: string;
  imagePath: string | null;
  imageUrl: string | null;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleUpload(file: File) {
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      const result = await uploadStockItemPhoto(stockItemId, jobSheetId, formData);
      if (result.ok) {
        setMessage(null);
        router.refresh();
      } else {
        setMessage(result.message);
      }
    });
  }

  function handleRemove() {
    if (!imagePath) return;
    startTransition(async () => {
      const result = await deleteStockItemPhoto(stockItemId, jobSheetId, imagePath);
      if (result.ok) {
        setMessage(null);
        router.refresh();
      } else {
        setMessage(result.message);
      }
    });
  }

  if (imageUrl) {
    return (
      <div className="flex items-center gap-1">
        <a href={imageUrl} target="_blank" rel="noreferrer" className="text-sm underline-offset-2 hover:underline">
          View
        </a>
        <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={handleRemove}>
          {isPending ? "Removing…" : "Remove"}
        </Button>
        {message && <p className="text-destructive text-xs">{message}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
          e.target.value = "";
        }}
      />
      <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => fileInputRef.current?.click()}>
        {isPending ? "Uploading…" : "Add photo"}
      </Button>
      {message && <p className="text-destructive text-xs">{message}</p>}
    </div>
  );
}
