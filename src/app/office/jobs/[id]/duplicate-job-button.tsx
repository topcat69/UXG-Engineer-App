"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { duplicateJobAction } from "./actions";

export function DuplicateJobButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await duplicateJobAction(jobId);
      if (result.ok) {
        router.push(`/office/jobs/${result.newJobId}`);
      } else {
        setMessage(result.message);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="outline" size="sm" onClick={handleClick} disabled={isPending}>
        {isPending ? "Duplicating…" : "Duplicate job"}
      </Button>
      {message && <span className="text-destructive text-sm">{message}</span>}
    </div>
  );
}
