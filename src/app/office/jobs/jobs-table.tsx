"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { JOB_TYPE_LABELS } from "@/lib/forms/job-form";
import { humanize } from "@/lib/format/text";
import { localInputValueToIso } from "@/lib/format/datetime-local";
import { bulkAssignJobs, bulkScheduleJobs } from "./actions";

export type JobRow = {
  id: string;
  job_number: string;
  job_type: string;
  status: string;
  priority: string | null;
  scheduled_start: string | null;
  assigned_to: string | null;
  site: { name: string; client: { name: string } | null } | null;
  project: { name: string } | null;
  assigned: { name: string } | null;
};

export function JobsTable({ jobs, engineers }: { jobs: JobRow[]; engineers: { id: string; name: string }[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [engineerId, setEngineerId] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [durationHours, setDurationHours] = useState(2);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const allSelected = jobs.length > 0 && jobs.every((j) => selected.has(j.id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(jobs.map((j) => j.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  function runAssign() {
    if (!engineerId) return;
    startTransition(async () => {
      const result = await bulkAssignJobs(selectedIds, engineerId);
      setMessage(result.message);
      router.refresh();
    });
  }

  function runSchedule() {
    if (!scheduleAt) return;
    startTransition(async () => {
      // Converted to a UTC instant here, client-side (browser-local
      // timezone), rather than sending the raw datetime-local string for
      // the server to parse in its own timezone — see the matching
      // comment in assign-schedule-panel.tsx for why that silently shifted
      // saved times by the server/browser offset.
      const result = await bulkScheduleJobs(selectedIds, localInputValueToIso(scheduleAt), durationHours);
      setMessage(result.message);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/40 p-3">
          <span className="text-sm font-medium">{selectedIds.length} selected</span>

          <div className="flex items-center gap-2">
            <select
              aria-label="Assign to"
              value={engineerId}
              onChange={(e) => setEngineerId(e.target.value)}
              className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
            >
              <option value="">Assign to…</option>
              {engineers.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <Button size="sm" disabled={!engineerId || isPending} onClick={runAssign}>
              Assign
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <input
              aria-label="Scheduled start"
              type="datetime-local"
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
              className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
            />
            <input
              aria-label="Duration in hours"
              type="number"
              min={1}
              max={12}
              value={durationHours}
              onChange={(e) => setDurationHours(Number(e.target.value))}
              className="border-input h-9 w-16 rounded-md border bg-transparent px-2 text-sm"
              title="Duration (hours)"
            />
            <span className="text-muted-foreground text-xs">hrs</span>
            <Button size="sm" disabled={!scheduleAt || isPending} onClick={runSchedule}>
              Schedule
            </Button>
          </div>

          {isPending && <span className="text-muted-foreground text-xs">Working…</span>}
        </div>
      )}

      {message && <p className="text-sm text-muted-foreground">{message}</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
            </TableHead>
            <TableHead>Job #</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Site</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Assigned</TableHead>
            <TableHead>Scheduled</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="text-muted-foreground text-center">
                No jobs match these filters.
              </TableCell>
            </TableRow>
          )}
          {jobs.map((job) => (
            <TableRow key={job.id}>
              <TableCell>
                <Checkbox checked={selected.has(job.id)} onCheckedChange={() => toggleOne(job.id)} aria-label={job.job_number} />
              </TableCell>
              <TableCell>
                <Link href={`/office/jobs/${job.id}`} className="font-medium underline-offset-2 hover:underline">
                  {job.job_number}
                </Link>
              </TableCell>
              <TableCell>{job.site?.client?.name ?? "—"}</TableCell>
              <TableCell>{job.site?.name ?? "—"}</TableCell>
              <TableCell>{job.project?.name ?? "—"}</TableCell>
              <TableCell>{JOB_TYPE_LABELS[job.job_type as keyof typeof JOB_TYPE_LABELS] ?? humanize(job.job_type)}</TableCell>
              <TableCell>
                <Badge variant="secondary">{humanize(job.status)}</Badge>
              </TableCell>
              <TableCell>{job.assigned?.name ?? "Unassigned"}</TableCell>
              <TableCell>
                {job.scheduled_start ? new Date(job.scheduled_start).toLocaleString() : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
