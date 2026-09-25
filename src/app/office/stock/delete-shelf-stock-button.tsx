"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deleteShelfStock } from "./actions";

export function DeleteShelfStockButton({
  manufacturer,
  model,
  quantity,
}: {
  manufacturer: string | null;
  model: string | null;
  quantity: number;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    const label = `${manufacturer ?? ""} ${model ?? ""}`.trim() || "this stock";
    if (!window.confirm(`Delete all ${quantity} ${label} from the shelf? This can't be undone.`)) return;
    startTransition(async () => {
      const result = await deleteShelfStock(manufacturer, model, quantity);
      if (result.ok) {
        setMessage(null);
        router.refresh();
      } else {
        setMessage(result.message);
      }
    });
  }

  return (
    <div className="flex items-center gap-1">
      <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={handleDelete}>
        {isPending ? "Deleting…" : "Delete"}
      </Button>
      {message && <p className="text-destructive text-xs">{message}</p>}
    </div>
  );
}
