"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteJobSheetAction } from "./actions";

/** Irreversible — same type-to-confirm pattern as DeleteJobButton, not just a click-through dialog. */
export function DeleteJobSheetButton({ jobSheetId, reference }: { jobSheetId: string; reference: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button type="button" variant="destructive" size="sm" onClick={() => setConfirming(true)}>
        Delete job sheet
      </Button>
    );
  }

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteJobSheetAction(jobSheetId);
      if (result.ok) {
        router.push("/office/job-sheets");
      } else {
        setMessage(result.message);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <p className="text-destructive max-w-xs text-right text-sm">
        This permanently deletes {reference} and every Stock Item still on it. Type the reference to confirm.
      </p>
      <input
        type="text"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={reference}
        className="border-input h-9 w-48 rounded-md border bg-transparent px-2 text-right text-sm"
      />
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
          Never mind
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={isPending || typed !== reference}
          onClick={handleConfirm}
        >
          {isPending ? "Deleting…" : "Permanently delete"}
        </Button>
      </div>
      {message && <span className="text-muted-foreground text-sm">{message}</span>}
    </div>
  );
}
