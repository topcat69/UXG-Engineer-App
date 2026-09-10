"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { allocateStockToJob } from "./actions";

export function AllocateStockControl({
  manufacturer,
  model,
  maxQuantity,
  jobSheets,
}: {
  manufacturer: string | null;
  model: string | null;
  maxQuantity: number;
  jobSheets: { id: string; reference: string }[];
}) {
  const router = useRouter();
  const [jobSheetId, setJobSheetId] = useState("");
  const [quantity, setQuantity] = useState(String(maxQuantity));
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAllocate() {
    startTransition(async () => {
      const result = await allocateStockToJob(manufacturer, model, jobSheetId, Number(quantity));
      if (result.ok) {
        setMessage(null);
        router.refresh();
      } else {
        setMessage(result.message);
      }
    });
  }

  if (jobSheets.length === 0) {
    return <span className="text-muted-foreground text-xs">No open job sheets</span>;
  }

  const qty = Number(quantity);
  const isValid = jobSheetId && Number.isInteger(qty) && qty >= 1 && qty <= maxQuantity;

  return (
    <div className="flex items-center gap-1">
      <select
        value={jobSheetId}
        onChange={(e) => setJobSheetId(e.target.value)}
        className="border-input h-8 rounded-md border bg-transparent px-1 text-xs"
      >
        <option value="">Job sheet…</option>
        {jobSheets.map((js) => (
          <option key={js.id} value={js.id}>
            {js.reference}
          </option>
        ))}
      </select>
      <input
        type="number"
        min={1}
        max={maxQuantity}
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        className="border-input h-8 w-16 rounded-md border bg-transparent px-1 text-xs"
      />
      <Button type="button" size="sm" variant="outline" disabled={isPending || !isValid} onClick={handleAllocate}>
        {isPending ? "Allocating…" : "Allocate"}
      </Button>
      {message && <p className="text-destructive text-xs">{message}</p>}
    </div>
  );
}
