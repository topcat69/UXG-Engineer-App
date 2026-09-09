"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { reassignStockItem } from "./actions";

export function ReassignStockItemControl({
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

  if (otherJobSheets.length === 0) {
    return <span className="text-muted-foreground text-xs">No other sheets to move to</span>;
  }

  return (
    <div className="flex items-center gap-1">
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
      {message && <p className="text-destructive text-xs">{message}</p>}
    </div>
  );
}
