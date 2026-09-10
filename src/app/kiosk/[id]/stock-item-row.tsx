"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { updateStockItem } from "./actions";
import { StockItemPhotoControl } from "./stock-item-photo-control";
import { StockItemTestedControl } from "./stock-item-tested-control";

const OTHER = "__other__";

type Manufacturer = { id: string; name: string };
type Model = { id: string; name: string; manufacturer_id: string; description: string | null };

type StockItem = {
  id: string;
  manufacturer: string | null;
  model: string | null;
  description: string | null;
  serial_no: string | null;
  hw_id: string | null;
  firmware_update: string | null;
  tested: boolean;
  damaged: boolean;
  damage_notes: string | null;
  received_at: string | null;
  image_path: string | null;
  imageUrl: string | null;
};

function fieldsFrom(item: StockItem, manufacturers: Manufacturer[], models: Model[]) {
  const matchedManufacturer = manufacturers.find((m) => m.name === item.manufacturer);
  const matchedModel = matchedManufacturer
    ? models.find((m) => m.manufacturer_id === matchedManufacturer.id && m.name === item.model)
    : undefined;
  return {
    manufacturerChoice: matchedManufacturer?.id ?? OTHER,
    manufacturerOther: matchedManufacturer ? "" : (item.manufacturer ?? ""),
    modelChoice: matchedModel?.id ?? OTHER,
    modelOther: matchedModel ? "" : (item.model ?? ""),
    description: item.description ?? "",
    serialNo: item.serial_no ?? "",
    hwId: item.hw_id ?? "",
    firmwareUpdate: item.firmware_update ?? "",
    damaged: item.damaged,
    damageNotes: item.damage_notes ?? "",
  };
}

/**
 * A checked-in item can turn out to have been scanned or typed wrong —
 * this edits it in place (via updateStockItem) rather than deleting and
 * re-adding, so the row's photo and Tested state survive the correction.
 * Renders as a normal row until "Edit" swaps it for the same field set
 * AddStockItemForm uses, pre-filled from the item's current values.
 */
export function StockItemRow({
  item,
  jobSheetId,
  manufacturers,
  models,
}: {
  item: StockItem;
  jobSheetId: string;
  manufacturers: Manufacturer[];
  models: Model[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState(() => fieldsFrom(item, manufacturers, models));
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedManufacturer = manufacturers.find((m) => m.id === fields.manufacturerChoice);
  const modelsForManufacturer = useMemo(
    () => (selectedManufacturer ? models.filter((m) => m.manufacturer_id === selectedManufacturer.id) : []),
    [models, selectedManufacturer],
  );

  function startEditing() {
    setFields(fieldsFrom(item, manufacturers, models));
    setMessage(null);
    setEditing(true);
  }

  function handleSave() {
    const manufacturer = fields.manufacturerChoice === OTHER ? fields.manufacturerOther : (selectedManufacturer?.name ?? "");
    const model =
      fields.manufacturerChoice === OTHER || fields.modelChoice === OTHER
        ? fields.modelOther
        : (modelsForManufacturer.find((m) => m.id === fields.modelChoice)?.name ?? "");

    startTransition(async () => {
      const result = await updateStockItem(
        item.id,
        jobSheetId,
        manufacturer,
        model,
        fields.description,
        fields.serialNo,
        fields.hwId,
        fields.firmwareUpdate,
        fields.damaged,
        fields.damageNotes,
      );
      if (result.ok) {
        setEditing(false);
        router.refresh();
      } else {
        setMessage(result.message);
      }
    });
  }

  if (editing) {
    return (
      <TableRow>
        <TableCell colSpan={11}>
          <div className="flex flex-col gap-3 rounded-md border bg-muted/40 p-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-muted-foreground text-xs">Manufacturer</label>
                <select
                  value={fields.manufacturerChoice}
                  onChange={(e) =>
                    setFields((f) => ({ ...f, manufacturerChoice: e.target.value, modelChoice: OTHER, modelOther: "" }))
                  }
                  className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
                >
                  <option value="">Select…</option>
                  {manufacturers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                  <option value={OTHER}>Other…</option>
                </select>
                {fields.manufacturerChoice === OTHER && (
                  <input
                    type="text"
                    value={fields.manufacturerOther}
                    onChange={(e) => setFields((f) => ({ ...f, manufacturerOther: e.target.value }))}
                    placeholder="Manufacturer name"
                    className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
                  />
                )}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-muted-foreground text-xs">Model</label>
                {fields.manufacturerChoice === OTHER ? (
                  <input
                    type="text"
                    value={fields.modelOther}
                    onChange={(e) => setFields((f) => ({ ...f, modelOther: e.target.value }))}
                    placeholder="Model name"
                    className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
                  />
                ) : (
                  <>
                    <select
                      value={fields.modelChoice}
                      onChange={(e) => {
                        const chosen = modelsForManufacturer.find((m) => m.id === e.target.value);
                        setFields((f) => ({ ...f, modelChoice: e.target.value, description: chosen?.description ?? f.description }));
                      }}
                      disabled={!selectedManufacturer}
                      className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
                    >
                      <option value="">{selectedManufacturer ? "Select…" : "Pick a manufacturer first"}</option>
                      {modelsForManufacturer.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                      {selectedManufacturer && <option value={OTHER}>Other…</option>}
                    </select>
                    {fields.modelChoice === OTHER && (
                      <input
                        type="text"
                        value={fields.modelOther}
                        onChange={(e) => setFields((f) => ({ ...f, modelOther: e.target.value }))}
                        placeholder="Model name"
                        className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
                      />
                    )}
                  </>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-muted-foreground text-xs">Description</label>
                <input
                  type="text"
                  value={fields.description}
                  onChange={(e) => setFields((f) => ({ ...f, description: e.target.value }))}
                  className="border-input h-9 w-56 rounded-md border bg-transparent px-2 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-muted-foreground text-xs">Serial no.</label>
                <input
                  type="text"
                  value={fields.serialNo}
                  onChange={(e) => setFields((f) => ({ ...f, serialNo: e.target.value }))}
                  className="border-input h-9 w-40 rounded-md border bg-transparent px-2 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-muted-foreground text-xs">H/W ID</label>
                <input
                  type="text"
                  value={fields.hwId}
                  onChange={(e) => setFields((f) => ({ ...f, hwId: e.target.value }))}
                  className="border-input h-9 w-40 rounded-md border bg-transparent px-2 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-muted-foreground text-xs">Firmware / update</label>
                <input
                  type="text"
                  value={fields.firmwareUpdate}
                  onChange={(e) => setFields((f) => ({ ...f, firmwareUpdate: e.target.value }))}
                  className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={fields.damaged}
                onChange={(e) => setFields((f) => ({ ...f, damaged: e.target.checked }))}
                className="h-4 w-4"
              />
              Damaged / DOA
            </label>
            {fields.damaged && (
              <div className="flex flex-col gap-1">
                <label className="text-muted-foreground text-xs">Damage notes</label>
                <input
                  type="text"
                  value={fields.damageNotes}
                  onChange={(e) => setFields((f) => ({ ...f, damageNotes: e.target.value }))}
                  className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" disabled={isPending} onClick={handleSave}>
                {isPending ? "Saving…" : "Save"}
              </Button>
              <Button type="button" size="sm" variant="ghost" disabled={isPending} onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
            {message && <p className="text-destructive text-sm">{message}</p>}
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell>{item.manufacturer ?? "—"}</TableCell>
      <TableCell>{item.model ?? "—"}</TableCell>
      <TableCell>{item.description ?? "—"}</TableCell>
      <TableCell>{item.serial_no ?? "—"}</TableCell>
      <TableCell>{item.hw_id ?? "—"}</TableCell>
      <TableCell>{item.firmware_update ?? "—"}</TableCell>
      <TableCell>
        <StockItemTestedControl stockItemId={item.id} jobSheetId={jobSheetId} tested={item.tested} />
      </TableCell>
      <TableCell>{item.damaged ? <Badge variant="destructive">Damaged</Badge> : "No"}</TableCell>
      <TableCell>{item.received_at ? new Date(item.received_at).toLocaleString() : "—"}</TableCell>
      <TableCell>
        <StockItemPhotoControl stockItemId={item.id} jobSheetId={jobSheetId} imagePath={item.image_path} imageUrl={item.imageUrl} />
      </TableCell>
      <TableCell>
        <Button type="button" size="sm" variant="outline" onClick={startEditing}>
          Edit
        </Button>
      </TableCell>
    </TableRow>
  );
}
