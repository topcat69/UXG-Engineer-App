"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BarcodeScanButton } from "@/components/field/barcode-scan-button";
import { addStockItem } from "./actions";

export function AddStockItemForm({ jobSheetId }: { jobSheetId: string }) {
  const router = useRouter();
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [serialNo, setSerialNo] = useState("");
  const [firmwareUpdate, setFirmwareUpdate] = useState("");
  const [tested, setTested] = useState(false);
  const [damaged, setDamaged] = useState(false);
  const [damageNotes, setDamageNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setManufacturer("");
    setModel("");
    setSerialNo("");
    setFirmwareUpdate("");
    setTested(false);
    setDamaged(false);
    setDamageNotes("");
  }

  function handleAdd() {
    startTransition(async () => {
      const result = await addStockItem(jobSheetId, manufacturer, model, serialNo, firmwareUpdate, tested, damaged, damageNotes);
      if (result.ok) {
        reset();
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
          <label className="text-muted-foreground text-xs">Manufacturer</label>
          <input
            type="text"
            value={manufacturer}
            onChange={(e) => setManufacturer(e.target.value)}
            className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs">Model</label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs">Serial no.</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={serialNo}
              onChange={(e) => setSerialNo(e.target.value)}
              placeholder="Scan, or type if no barcode"
              className="border-input h-9 w-48 rounded-md border bg-transparent px-2 text-sm"
            />
            <BarcodeScanButton onScan={(value) => setSerialNo(value)} />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs">Firmware / update</label>
          <input
            type="text"
            value={firmwareUpdate}
            onChange={(e) => setFirmwareUpdate(e.target.value)}
            className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={tested} onChange={(e) => setTested(e.target.checked)} className="h-4 w-4" />
          Tested — powers on OK
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={damaged} onChange={(e) => setDamaged(e.target.checked)} className="h-4 w-4" />
          Damaged / DOA
        </label>
      </div>
      {damaged && (
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs">Damage notes</label>
          <input
            type="text"
            value={damageNotes}
            onChange={(e) => setDamageNotes(e.target.value)}
            className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
          />
        </div>
      )}
      <div>
        <Button type="button" size="sm" disabled={isPending} onClick={handleAdd}>
          {isPending ? "Adding…" : "Add item"}
        </Button>
      </div>
      {message && <p className="text-destructive text-sm">{message}</p>}
    </div>
  );
}
