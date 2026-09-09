"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { JOB_TYPE_LABELS } from "@/lib/forms/job-form";
import { humanize } from "@/lib/format/text";
import { assignJobSheetToJob } from "./actions";

type Job = { id: string; job_number: string; job_type: string; status: string };

export function AssignToJobForm({ jobSheetId, jobs }: { jobSheetId: string; jobs: Job[] }) {
  const router = useRouter();
  const [jobId, setJobId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAssign() {
    startTransition(async () => {
      const result = await assignJobSheetToJob(jobSheetId, jobId);
      if (result.ok) {
        router.refresh();
      } else {
        setMessage(result.message);
      }
    });
  }

  if (jobs.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No jobs at this site yet — create one from Jobs first, then come back to assign this sheet.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-muted-foreground text-xs">Job</label>
        <select
          value={jobId}
          onChange={(e) => setJobId(e.target.value)}
          className="border-input h-9 w-72 rounded-md border bg-transparent px-2 text-sm"
        >
          <option value="">Select…</option>
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.job_number} — {JOB_TYPE_LABELS[job.job_type as keyof typeof JOB_TYPE_LABELS] ?? humanize(job.job_type)} (
              {humanize(job.status)})
            </option>
          ))}
        </select>
      </div>
      <Button type="button" size="sm" disabled={isPending || !jobId} onClick={handleAssign}>
        {isPending ? "Assigning…" : "Assign to job"}
      </Button>
      {message && <p className="text-destructive text-sm">{message}</p>}
    </div>
  );
}
