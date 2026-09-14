"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { updateTestResultDetails } from "./actions";
import { TestResultFlagControl } from "./test-result-flag-control";
import { TestResultWifiDongleControl } from "./test-result-wifi-dongle-control";

export type TestResultRowData = {
  id: string;
  item_description: string | null;
  wifi_dongle: string | null;
  tested: boolean | null;
  licence_added: boolean | null;
  teamviewer_added: boolean | null;
  philips_wave_added: boolean | null;
  added_to_uxg_account: boolean | null;
  outcome: string | null;
  notes: string | null;
  stock_item: { manufacturer: string | null; model: string | null; serial_no: string | null } | null;
};

/** A goods-in scan's own manufacturer/model/serial, live — see addStockItem — or the free-text description for a manually-added row. */
function itemLabel(t: TestResultRowData): string {
  if (t.stock_item) {
    const name = [t.stock_item.manufacturer, t.stock_item.model].filter(Boolean).join(" ");
    return t.stock_item.serial_no ? `${name || "Unlisted item"} — ${t.stock_item.serial_no}` : name || "Unlisted item";
  }
  return t.item_description ?? "—";
}

export function TestResultRow({ jobSheetId, testResult }: { jobSheetId: string; testResult: TestResultRowData }) {
  const router = useRouter();
  const [outcome, setOutcome] = useState(testResult.outcome ?? "");
  const [notes, setNotes] = useState(testResult.notes ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSaveDetails() {
    startTransition(async () => {
      const result = await updateTestResultDetails(testResult.id, jobSheetId, { outcome, notes });
      setMessage(result.ok ? null : result.message);
      if (result.ok) router.refresh();
    });
  }

  return (
    <TableRow>
      <TableCell>{itemLabel(testResult)}</TableCell>
      <TableCell>
        <TestResultWifiDongleControl testId={testResult.id} jobSheetId={jobSheetId} value={testResult.wifi_dongle} />
      </TableCell>
      <TableCell>
        <TestResultFlagControl testId={testResult.id} jobSheetId={jobSheetId} field="tested" value={testResult.tested} label="Tested" />
      </TableCell>
      <TableCell>
        <TestResultFlagControl
          testId={testResult.id}
          jobSheetId={jobSheetId}
          field="licence_added"
          value={testResult.licence_added}
          label="Licence added"
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <TestResultFlagControl
            testId={testResult.id}
            jobSheetId={jobSheetId}
            field="teamviewer_added"
            value={testResult.teamviewer_added}
            label="TeamViewer added"
          />
          <TestResultFlagControl
            testId={testResult.id}
            jobSheetId={jobSheetId}
            field="philips_wave_added"
            value={testResult.philips_wave_added}
            label="Philips Wave"
          />
        </div>
      </TableCell>
      <TableCell>
        <TestResultFlagControl
          testId={testResult.id}
          jobSheetId={jobSheetId}
          field="added_to_uxg_account"
          value={testResult.added_to_uxg_account}
          label="UXG account"
        />
      </TableCell>
      <TableCell>
        <input
          type="text"
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          className="border-input h-9 w-32 rounded-md border bg-transparent px-2 text-sm"
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="border-input h-9 w-40 rounded-md border bg-transparent px-2 text-sm"
          />
          <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={handleSaveDetails}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </div>
        {message && <p className="text-destructive text-xs">{message}</p>}
      </TableCell>
    </TableRow>
  );
}
