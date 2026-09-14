"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { updateSoftwareSetup } from "./actions";

const OTHER = "__other__";
const NA = "N/A";

function initialChoice(cmsName: string | null, providerNames: string[]): { choice: string; other: string } {
  if (!cmsName) return { choice: "", other: "" };
  if (cmsName === NA || providerNames.includes(cmsName)) return { choice: cmsName, other: "" };
  return { choice: OTHER, other: cmsName };
}

/**
 * Licence added/TeamViewer added/Added to UXG account moved to
 * Configuration (see test-result-row.tsx) — this is just the CMS
 * provider itself plus notes now. Same Other-fallback pattern as the
 * Manufacturer/Model selects on AddStockItemForm: cms_name is still a
 * plain text column, the dropdown is just curated convenience over it.
 */
export function SoftwareSetupForm({
  jobSheetId,
  cmsName,
  softwareNotes,
  softwareProviders,
}: {
  jobSheetId: string;
  cmsName: string | null;
  softwareNotes: string | null;
  softwareProviders: { id: string; name: string }[];
}) {
  const router = useRouter();
  const providerNames = softwareProviders.map((p) => p.name);
  const initial = initialChoice(cmsName, providerNames);
  const [choice, setChoice] = useState(initial.choice);
  const [other, setOther] = useState(initial.other);
  const [softwareNotesValue, setSoftwareNotesValue] = useState(softwareNotes ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    const resolvedCmsName = choice === OTHER ? other : choice;
    startTransition(async () => {
      const result = await updateSoftwareSetup(jobSheetId, { cmsName: resolvedCmsName, softwareNotes: softwareNotesValue });
      setMessage(result.ok ? "Saved." : result.message);
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border bg-muted/40 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs">CMS provider</label>
          <select
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            className="border-input h-9 w-48 rounded-md border bg-transparent px-2 text-sm"
          >
            <option value="">Select…</option>
            {softwareProviders.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name}
              </option>
            ))}
            <option value={OTHER}>Other…</option>
            <option value={NA}>N/A</option>
          </select>
          {choice === OTHER && (
            <input
              type="text"
              value={other}
              onChange={(e) => setOther(e.target.value)}
              placeholder="CMS provider name"
              className="border-input h-9 w-48 rounded-md border bg-transparent px-2 text-sm"
            />
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs">Notes</label>
          <input
            type="text"
            value={softwareNotesValue}
            onChange={(e) => setSoftwareNotesValue(e.target.value)}
            className="border-input h-9 w-64 rounded-md border bg-transparent px-2 text-sm"
          />
        </div>
        <Button type="button" size="sm" disabled={isPending} onClick={handleSave}>
          {isPending ? "Saving…" : "Save"}
        </Button>
      </div>
      {message && <p className="text-muted-foreground text-sm">{message}</p>}
    </div>
  );
}
