"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deleteStockItem, reassignStockItem } from "./actions";

export function StockItemActions({
  stockItemId,
  currentJobSheetId,
  otherJobSheets,
}: {
  stockItemId: string;
  currentJobSheetId: string;
  otherJobSheets: { id: string; reference: string }[];
}) {
  const router = useRouter();
  const [targetId, setTargetId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleMove() {
    startTransition(async () => {
      const result = await reassignStockItem(stockItemId, currentJobSheetId, targetId);
      if (result.ok) {
        router.refresh();
      } else {
        setMessage(result.message);
      }
    });
  }

  function handleDelete() {
    if (!window.confirm("Delete this stock item? This can't be undone.")) return;
    startTransition(async () => {
      const result = await deleteStockItem(stockItemId, currentJobSheetId);
      if (result.ok) {
        router.refresh();
      } else {
        setMessage(result.message);
      }
    });
  }

  return (
    <div className="flex items-center gap-1">
      {otherJobSheets.length === 0 ? (
        <span className="text-muted-foreground text-xs">No other sheets to move to</span>
      ) : (
        <>
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="border-input h-8 rounded-md border bg-transparent px-1 text-xs"
          >
            <option value="">Move to…</option>
            {otherJobSheets.map((js) => (
              <option key={js.id} value={js.id}>
                {js.reference}
              </option>
            ))}
          </select>
          <Button type="button" size="sm" variant="outline" disabled={isPending || !targetId} onClick={handleMove}>
            {isPending ? "Moving…" : "Move"}
          </Button>
        </>
      )}
      <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={handleDelete}>
        Delete
      </Button>
      {message && <p className="text-destructive text-xs">{message}</p>}
    </div>
  );
}
