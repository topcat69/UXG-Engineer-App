"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { updateSoftwareSetup } from "./actions";

export function SoftwareSetupForm({
  jobSheetId,
  cmsName,
  licenceAdded,
  teamviewerAdded,
  addedToUxgAccount,
  softwareNotes,
}: {
  jobSheetId: string;
  cmsName: string | null;
  licenceAdded: boolean | null;
  teamviewerAdded: boolean | null;
  addedToUxgAccount: boolean | null;
  softwareNotes: string | null;
}) {
  const router = useRouter();
  const [state, setState] = useState({
    cmsName: cmsName ?? "",
    licenceAdded: licenceAdded ?? false,
    teamviewerAdded: teamviewerAdded ?? false,
    addedToUxgAccount: addedToUxgAccount ?? false,
    softwareNotes: softwareNotes ?? "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await updateSoftwareSetup(jobSheetId, state);
      setMessage(result.ok ? "Saved." : result.message);
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border bg-muted/40 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs">CMS name</label>
          <input
            type="text"
            value={state.cmsName}
            onChange={(e) => setState((s) => ({ ...s, cmsName: e.target.value }))}
            className="border-input h-9 w-48 rounded-md border bg-transparent px-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs">Notes</label>
          <input
            type="text"
            value={state.softwareNotes}
            onChange={(e) => setState((s) => ({ ...s, softwareNotes: e.target.value }))}
            className="border-input h-9 w-64 rounded-md border bg-transparent px-2 text-sm"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={state.licenceAdded}
            onChange={(e) => setState((s) => ({ ...s, licenceAdded: e.target.checked }))}
            className="h-4 w-4"
          />
          Licence added
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={state.teamviewerAdded}
            onChange={(e) => setState((s) => ({ ...s, teamviewerAdded: e.target.checked }))}
            className="h-4 w-4"
          />
          TeamViewer added
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={state.addedToUxgAccount}
            onChange={(e) => setState((s) => ({ ...s, addedToUxgAccount: e.target.checked }))}
            className="h-4 w-4"
          />
          Added to UXG account
        </label>
        <Button type="button" size="sm" disabled={isPending} onClick={handleSave}>
          {isPending ? "Saving…" : "Save"}
        </Button>
      </div>
      {message && <p className="text-muted-foreground text-sm">{message}</p>}
    </div>
  );
}
