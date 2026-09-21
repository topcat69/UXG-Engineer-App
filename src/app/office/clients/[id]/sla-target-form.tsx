"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { updateClientSlaTarget } from "./sla-list-actions";

/**
 * One number per customer, feeding the SLA compliance report's met/breached
 * classification (see lib/reports/sla-compliance.ts) — separate from the
 * Fixture Types/Reasons lists below since it's a single field, not a
 * per-customer list.
 */
export function SlaTargetForm({ clientId, initialHours }: { clientId: string; initialHours: number | null }) {
  const [value, setValue] = useState(initialHours != null ? String(initialHours) : "");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await updateClientSlaTarget(clientId, value);
      if (result.ok) {
        setValue(result.hours != null ? String(result.hours) : "");
        setMessage(result.hours != null ? `Target set to ${result.hours} hour(s).` : "Target cleared.");
      } else {
        setMessage(result.message);
      }
    });
  }

  return (
    <section className="flex flex-col gap-2 border-t pt-4">
      <h2 className="font-medium">SLA target</h2>
      <p className="text-muted-foreground text-sm">
        How many hours this customer&apos;s SLA jobs have to be completed within, measured from the engineer starting
        the job to submitting it. Used by the SLA compliance report to mark each job met or breached. Leave blank if
        this customer has no SLA jobs, or none of them are classified yet.
      </p>
      <div className="flex items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs" htmlFor="sla_target_hours">
            Target (hours)
          </label>
          <input
            id="sla_target_hours"
            type="number"
            min="0"
            step="0.5"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. 4"
            className="border-input h-9 w-32 rounded-md border bg-transparent px-2 text-sm"
          />
        </div>
        <Button type="button" size="sm" disabled={isPending} onClick={handleSave}>
          Save
        </Button>
      </div>
      {message && <p className="text-muted-foreground text-sm">{message}</p>}
    </section>
  );
}
