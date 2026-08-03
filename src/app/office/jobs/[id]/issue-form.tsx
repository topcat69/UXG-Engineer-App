"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { raiseIssue } from "./actions";

export function IssueForm({ jobId, siteId }: { jobId: string; siteId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await raiseIssue(jobId, siteId, formData);
      setMessage(result.message);
      if (result.ok) formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <select
          name="severity"
          aria-label="Severity"
          required
          className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
        >
          <option value="">Severity…</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </div>
      <Textarea name="description" placeholder="What's wrong?" required rows={2} />
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          Raise issue
        </Button>
        {message && <span className="text-muted-foreground text-sm">{message}</span>}
      </div>
    </form>
  );
}
