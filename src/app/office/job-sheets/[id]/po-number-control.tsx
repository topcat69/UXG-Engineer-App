"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { updateJobSheetPoNumber } from "./actions";

/**
 * The one editable header field on this page (see page.tsx's own comment
 * on why everything else here is read-only for Office) — saving it also
 * updates the linked job's PO Number, if this sheet is already assigned
 * to one (see updateJobSheetPoNumber).
 */
export function PoNumberControl({ jobSheetId, value }: { jobSheetId: string; value: string | null }) {
  const router = useRouter();
  const [poNumber, setPoNumber] = useState(value ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await updateJobSheetPoNumber(jobSheetId, poNumber);
      if (result.ok) {
        setMessage(null);
        router.refresh();
      } else {
        setMessage(result.message);
      }
    });
  }

  return (
    <div className="flex items-end gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-muted-foreground text-xs">PO number</label>
        <input
          type="text"
          value={poNumber}
          onChange={(e) => setPoNumber(e.target.value)}
          className="border-input h-9 w-48 rounded-md border bg-transparent px-2 text-sm"
        />
      </div>
      <Button type="button" size="sm" variant="outline" disabled={isPending || poNumber === (value ?? "")} onClick={handleSave}>
        {isPending ? "Saving…" : "Save"}
      </Button>
      {message && <p className="text-destructive text-xs">{message}</p>}
    </div>
  );
}
