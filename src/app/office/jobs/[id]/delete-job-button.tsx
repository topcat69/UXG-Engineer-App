"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteJobAction } from "./actions";

/** Irreversible, unlike Cancel — so confirmation requires typing the job number, not just a click-through dialog. */
export function DeleteJobButton({ jobId, jobNumber }: { jobId: string; jobNumber: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button type="button" variant="destructive" size="sm" onClick={() => setConfirming(true)}>
        Delete job
      </Button>
    );
  }

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteJobAction(jobId);
      if (result.ok) {
        router.push("/office/jobs");
      } else {
        setMessage(result.message);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <p className="text-destructive max-w-xs text-right text-sm">
        This permanently deletes {jobNumber} and everything on it — photos, forms, issues, history. Type the job
        number to confirm.
      </p>
      <input
        type="text"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={jobNumber}
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
          disabled={isPending || typed !== jobNumber}
          onClick={handleConfirm}
        >
          {isPending ? "Deleting…" : "Permanently delete"}
        </Button>
      </div>
      {message && <span className="text-muted-foreground text-sm">{message}</span>}
    </div>
  );
}
