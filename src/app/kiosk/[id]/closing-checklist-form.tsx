"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { updateClosingChecklist, type ClosingChecklistInput } from "./actions";
import { ChecklistPhotoControl } from "./checklist-photo-control";
import type { ChecklistItem, ChecklistKey } from "./checklist-item";

const ITEMS: { key: ChecklistKey; label: string }[] = [
  { key: "defects", label: "Defects" },
  { key: "missingItems", label: "Missing items" },
  { key: "packedCorrectly", label: "Items packed correctly" },
  { key: "otherPartsUsed", label: "Other parts used" },
  { key: "otherIssues", label: "Other issues" },
];

export function ClosingChecklistForm({
  jobSheetId,
  initial,
  workAreaTidy,
  photos,
}: {
  jobSheetId: string;
  initial: Record<ChecklistKey, ChecklistItem>;
  workAreaTidy: boolean | null;
  photos: Record<ChecklistKey, { photoPath: string | null; imageUrl: string | null }>;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [tidy, setTidy] = useState(workAreaTidy ?? false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateItem(key: ChecklistKey, patch: Partial<ChecklistItem>) {
    setItems((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  function handleSave() {
    startTransition(async () => {
      const input: ClosingChecklistInput = { ...items, workAreaTidy: tidy };
      const result = await updateClosingChecklist(jobSheetId, input);
      setMessage(result.ok ? "Saved." : result.message);
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border bg-muted/40 p-3">
      {ITEMS.map(({ key, label }) => (
        <div key={key} className="flex flex-wrap items-center gap-3">
          <label className="flex w-48 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={items[key].flag}
              onChange={(e) => updateItem(key, { flag: e.target.checked })}
              className="h-4 w-4"
            />
            {label}
          </label>
          <input
            type="text"
            value={items[key].detail}
            onChange={(e) => updateItem(key, { detail: e.target.value })}
            placeholder="Detail"
            className="border-input h-9 w-56 rounded-md border bg-transparent px-2 text-sm"
          />
          <ChecklistPhotoControl
            jobSheetId={jobSheetId}
            checklistKey={key}
            photoPath={photos[key].photoPath}
            imageUrl={photos[key].imageUrl}
          />
        </div>
      ))}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={tidy} onChange={(e) => setTidy(e.target.checked)} className="h-4 w-4" />
        Work area left tidy?
      </label>
      <div>
        <Button type="button" size="sm" disabled={isPending} onClick={handleSave}>
          {isPending ? "Saving…" : "Save"}
        </Button>
      </div>
      {message && <p className="text-muted-foreground text-sm">{message}</p>}
    </div>
  );
}
