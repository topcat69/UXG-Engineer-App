"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { addTestResult } from "./actions";

/** For an item that's part of this job but never went through goods-in — every scanned item already gets its own row automatically. */
export function AddTestResultForm({ jobSheetId }: { jobSheetId: string }) {
  const router = useRouter();
  const [itemDescription, setItemDescription] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    startTransition(async () => {
      const result = await addTestResult(jobSheetId, itemDescription);
      if (result.ok) {
        setItemDescription("");
        setMessage(null);
        router.refresh();
      } else {
        setMessage(result.message);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-md border bg-muted/40 p-3">
      <div className="flex flex-col gap-1">
        <label className="text-muted-foreground text-xs">Item not from goods-in (e.g. already on site)</label>
        <input
          type="text"
          value={itemDescription}
          onChange={(e) => setItemDescription(e.target.value)}
          className="border-input h-9 w-64 rounded-md border bg-transparent px-2 text-sm"
        />
      </div>
      <Button type="button" size="sm" disabled={isPending || !itemDescription.trim()} onClick={handleAdd}>
        {isPending ? "Adding…" : "Add item"}
      </Button>
      {message && <p className="text-destructive text-sm">{message}</p>}
    </div>
  );
}
