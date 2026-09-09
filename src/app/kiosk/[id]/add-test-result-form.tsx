"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { addTestResult } from "./actions";

export function AddTestResultForm({ jobSheetId }: { jobSheetId: string }) {
  const router = useRouter();
  const [itemDescription, setItemDescription] = useState("");
  const [irBud, setIrBud] = useState(false);
  const [wifiCable, setWifiCable] = useState("");
  const [tested, setTested] = useState(false);
  const [outcome, setOutcome] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    startTransition(async () => {
      const result = await addTestResult(jobSheetId, itemDescription, irBud, wifiCable, tested, outcome, notes);
      if (result.ok) {
        setItemDescription("");
        setIrBud(false);
        setWifiCable("");
        setTested(false);
        setOutcome("");
        setNotes("");
        setMessage(null);
        router.refresh();
      } else {
        setMessage(result.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border bg-muted/40 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs">Item / job description</label>
          <input
            type="text"
            value={itemDescription}
            onChange={(e) => setItemDescription(e.target.value)}
            className="border-input h-9 w-48 rounded-md border bg-transparent px-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs">Wifi / cable?</label>
          <input
            type="text"
            value={wifiCable}
            onChange={(e) => setWifiCable(e.target.value)}
            className="border-input h-9 w-32 rounded-md border bg-transparent px-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs">Outcome</label>
          <input
            type="text"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            className="border-input h-9 w-32 rounded-md border bg-transparent px-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs">Notes</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="border-input h-9 w-48 rounded-md border bg-transparent px-2 text-sm"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={irBud} onChange={(e) => setIrBud(e.target.checked)} className="h-4 w-4" />
          IR bud
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={tested} onChange={(e) => setTested(e.target.checked)} className="h-4 w-4" />
          Tested
        </label>
        <Button type="button" size="sm" disabled={isPending} onClick={handleAdd}>
          {isPending ? "Adding…" : "Add test result"}
        </Button>
      </div>
      {message && <p className="text-destructive text-sm">{message}</p>}
    </div>
  );
}
