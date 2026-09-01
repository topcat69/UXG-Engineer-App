"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cancelJob } from "./actions";

export function CancelJobButton({ jobId, status }: { jobId: string; status: string }) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (status === "cancelled" || status === "closed" || status === "revisit") return null;

  if (!confirming) {
    return (
      <Button type="button" variant="destructive" size="sm" onClick={() => setConfirming(true)}>
        Cancel job
      </Button>
    );
  }

  function handleConfirm() {
    startTransition(async () => {
      const result = await cancelJob(jobId, reason);
      setMessage(result.message);
      if (result.ok) setConfirming(false);
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (optional)"
        className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
      />
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
          Never mind
        </Button>
        <Button type="button" variant="destructive" size="sm" disabled={isPending} onClick={handleConfirm}>
          Confirm cancel
        </Button>
      </div>
      {message && <span className="text-muted-foreground text-sm">{message}</span>}
    </div>
  );
}
