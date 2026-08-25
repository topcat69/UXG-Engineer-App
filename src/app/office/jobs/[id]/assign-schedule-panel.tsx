"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { assignAndScheduleJob } from "./actions";

type Engineer = { id: string; name: string };

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Deliberately positioned as the last thing on the job detail page, below
 * every panel that can add something worth attaching to the "New Job
 * Scheduled" email (RAMS/site plan/job information/equipment) — this is
 * the action that actually sends that email, and it used to sit at the
 * top of the page, so scheduling right after creating a job (a natural
 * first instinct) sent it before any of that existed to attach. See
 * DECISIONS.md. Was originally styled to fit a compact top-right corner
 * (right-aligned); now a full-width section like everything else on the
 * page, so it's left-aligned instead.
 */
export function AssignSchedulePanel({
  jobId,
  assignedTo,
  assignedName,
  scheduledStart,
  scheduledEnd,
  engineers,
}: {
  jobId: string;
  assignedTo: string | null;
  assignedName: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  engineers: Engineer[];
}) {
  const [editing, setEditing] = useState(false);
  const [engineerId, setEngineerId] = useState(assignedTo ?? "");
  const [scheduledLocal, setScheduledLocal] = useState(toLocalInputValue(scheduledStart));
  const [scheduledEndLocal, setScheduledEndLocal] = useState(toLocalInputValue(scheduledEnd));
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await assignAndScheduleJob(jobId, engineerId || null, scheduledLocal, scheduledEndLocal);
      setMessage(result.ok ? (result.warning ?? null) : result.message);
      if (result.ok) setEditing(false);
    });
  }

  if (!editing) {
    const endLabel =
      scheduledStart && scheduledEnd && scheduledStart.slice(0, 10) !== scheduledEnd.slice(0, 10)
        ? ` → ${new Date(scheduledEnd).toLocaleString()}`
        : "";
    return (
      <div className="text-sm">
        <p>Assigned: {assignedName ?? "Unassigned"}</p>
        <p className="text-muted-foreground">
          {scheduledStart ? new Date(scheduledStart).toLocaleString() : "Not scheduled"}
          {endLabel}
        </p>
        <button type="button" onClick={() => setEditing(true)} className="text-xs underline">
          Assign / schedule
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2 text-sm">
      <div className="flex flex-col items-start gap-1">
        <label className="text-muted-foreground text-xs">Assigned to</label>
        <select
          value={engineerId}
          onChange={(e) => setEngineerId(e.target.value)}
          className="border-input h-8 rounded-md border bg-transparent px-2 text-sm"
        >
          <option value="">Unassigned</option>
          {engineers.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col items-start gap-1">
        <label className="text-muted-foreground text-xs">Scheduled start</label>
        <input
          type="datetime-local"
          value={scheduledLocal}
          onChange={(e) => setScheduledLocal(e.target.value)}
          className="border-input h-8 rounded-md border bg-transparent px-2 text-sm"
        />
      </div>
      <div className="flex flex-col items-start gap-1">
        <label className="text-muted-foreground text-xs">Scheduled end</label>
        <input
          type="datetime-local"
          value={scheduledEndLocal}
          onChange={(e) => setScheduledEndLocal(e.target.value)}
          className="border-input h-8 rounded-md border bg-transparent px-2 text-sm"
        />
        <span className="text-muted-foreground text-[10px]">Can be a later date for a multi-day job</span>
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={isPending} onClick={handleSave}>
          {isPending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
      {message && <p className="text-muted-foreground max-w-48 text-xs">{message}</p>}
    </div>
  );
}
