"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { localInputValueToIso, toLocalInputValue } from "@/lib/format/datetime-local";
import { assignAndScheduleJob } from "./actions";

type Engineer = { id: string; name: string };

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
  isProvisional,
  engineers,
}: {
  jobId: string;
  assignedTo: string | null;
  assignedName: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  isProvisional: boolean;
  engineers: Engineer[];
}) {
  const [editing, setEditing] = useState(false);
  const [engineerId, setEngineerId] = useState(assignedTo ?? "");
  const [scheduledLocal, setScheduledLocal] = useState(toLocalInputValue(scheduledStart));
  const [scheduledEndLocal, setScheduledEndLocal] = useState(toLocalInputValue(scheduledEnd));
  const [provisional, setProvisional] = useState(isProvisional);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      // Converted to a real UTC instant here, client-side, where the
      // browser's actual local timezone applies — sending the raw
      // datetime-local string across the Server Action boundary and
      // parsing it server-side used the *server's* timezone instead,
      // silently shifting the saved time (BST office, UTC server: a typed
      // 10:00 was saved as 10:00 UTC, i.e. 11:00 BST once redisplayed).
      const result = await assignAndScheduleJob(
        jobId,
        engineerId || null,
        localInputValueToIso(scheduledLocal),
        localInputValueToIso(scheduledEndLocal),
        provisional,
      );
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
        {isProvisional && <p className="font-medium text-pink-600">Provisional — not yet confirmed</p>}
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
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="provisional-checkbox"
          checked={provisional}
          onChange={(e) => setProvisional(e.target.checked)}
          className="h-4 w-4"
        />
        <label htmlFor="provisional-checkbox" className="text-xs">
          Provisional — not confirmed yet (engineer can view but not start it)
        </label>
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
