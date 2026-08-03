"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { approveJob, rejectJob } from "./actions";

export function QaRow({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleApprove() {
    startTransition(async () => {
      const result = await approveJob(jobId);
      setMessage(result.message);
      router.refresh();
    });
  }

  function handleReject() {
    startTransition(async () => {
      const result = await rejectJob(jobId, reason);
      setMessage(result.message);
      router.refresh();
    });
  }

  if (message) {
    return <p className="text-muted-foreground text-sm">{message}</p>;
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Button size="sm" disabled={isPending} onClick={handleApprove}>
        Approve
      </Button>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason to reject…"
        className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
      />
      <Button size="sm" variant="destructive" disabled={isPending || !reason.trim()} onClick={handleReject}>
        Reject → Revisit
      </Button>
    </div>
  );
}
