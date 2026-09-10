"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BarcodeScanButton } from "@/components/field/barcode-scan-button";
import { parseStockQrCode } from "@/lib/stock/parse-stock-qr";
import { addStockItem } from "./actions";

const OTHER = "__other__";

export function AddStockItemForm({
  jobSheetId,
  manufacturers,
  models,
}: {
  jobSheetId: string;
  manufacturers: { id: string; name: string }[];
  models: { id: string; name: string; manufacturer_id: string; description: string | null }[];
}) {
  const router = useRouter();
  const [manufacturerChoice, setManufacturerChoice] = useState("");
  const [manufacturerOther, setManufacturerOther] = useState("");
  const [modelChoice, setModelChoice] = useState("");
  const [modelOther, setModelOther] = useState("");
  const [description, setDescription] = useState("");
  const [serialNo, setSerialNo] = useState("");
  const [hwId, setHwId] = useState("");
  const [firmwareUpdate, setFirmwareUpdate] = useState("");
  const [tested, setTested] = useState(false);
  const [damaged, setDamaged] = useState(false);
  const [damageNotes, setDamageNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedManufacturer = manufacturers.find((m) => m.id === manufacturerChoice);
  const modelsForManufacturer = useMemo(
    () => (selectedManufacturer ? models.filter((m) => m.manufacturer_id === selectedManufacturer.id) : []),
    [models, selectedManufacturer],
  );

  function reset() {
    setManufacturerChoice("");
    setManufacturerOther("");
    setModelChoice("");
    setModelOther("");
    setDescription("");
    setSerialNo("");
    setHwId("");
    setFirmwareUpdate("");
    setTested(false);
    setDamaged(false);
    setDamageNotes("");
  }

  /**
   * The label QR on a lot of AV kit packs Model/Serial/H-W ID together
   * (see parse-stock-qr.ts) — a scan here fills all three, plus looks the
   * model up against the Stock Catalog already loaded into this form:
   * matched -> Manufacturer/Model/Description auto-fill from the catalog;
   * unmatched -> Manufacturer drops to "Other…" and Model is pre-filled
   * with the scanned text so the warehouse only has to type the
   * manufacturer (and optionally a description) once — addStockItem then
   * registers that combination in the catalog for next time. A plain
   * barcode with no comma-delimited payload just falls back to today's
   * behaviour: the raw value goes straight into Serial no.
   */
  function handleScan(rawValue: string) {
    const parsed = parseStockQrCode(rawValue);
    if (!parsed) {
      setSerialNo(rawValue);
      return;
    }

    setSerialNo(parsed.serialNo);
    setHwId(parsed.hwId);

    const matchedModel = models.find((m) => m.name.trim().toLowerCase() === parsed.model.trim().toLowerCase());
    if (matchedModel) {
      const matchedManufacturer = manufacturers.find((m) => m.id === matchedModel.manufacturer_id);
      setManufacturerChoice(matchedManufacturer?.id ?? OTHER);
      setModelChoice(matchedModel.id);
      setModelOther(parsed.model);
      setDescription(matchedModel.description ?? "");
    } else {
      setManufacturerChoice(OTHER);
      setManufacturerOther("");
      setModelChoice("");
      setModelOther(parsed.model);
      setDescription("");
    }
  }

  function handleAdd() {
    const manufacturer = manufacturerChoice === OTHER ? manufacturerOther : (selectedManufacturer?.name ?? "");
    const model =
      manufacturerChoice === OTHER || modelChoice === OTHER
        ? modelOther
        : (modelsForManufacturer.find((m) => m.id === modelChoice)?.name ?? "");

    startTransition(async () => {
      const result = await addStockItem(
        jobSheetId,
        manufacturer,
        model,
        description,
        serialNo,
        hwId,
        firmwareUpdate,
        tested,
        damaged,
        damageNotes,
      );
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
          <select
            value={manufacturerChoice}
            onChange={(e) => {
              // Switching manufacturer invalidates the *selected* model (it
              // belonged to the old manufacturer's list) but must never
              // wipe modelOther — a scanned model name is often typed here
              // before the manufacturer gets corrected to a real catalog
              // entry, and losing it silently on that correction is exactly
              // what caused Model to end up blank on submit.
              setManufacturerChoice(e.target.value);
              setModelChoice(modelOther ? OTHER : "");
            }}
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
          {manufacturerChoice === OTHER && (
            <input
              type="text"
              value={manufacturerOther}
              onChange={(e) => setManufacturerOther(e.target.value)}
              placeholder="Manufacturer name"
              className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
            />
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs">Model</label>
          {manufacturerChoice === OTHER ? (
            <input
              type="text"
              value={modelOther}
              onChange={(e) => setModelOther(e.target.value)}
              placeholder="Model name"
              className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
            />
          ) : (
            <>
              <select
                value={modelChoice}
                onChange={(e) => {
                  setModelChoice(e.target.value);
                  setDescription(modelsForManufacturer.find((m) => m.id === e.target.value)?.description ?? "");
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
              {modelChoice === OTHER && (
                <input
                  type="text"
                  value={modelOther}
                  onChange={(e) => setModelOther(e.target.value)}
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
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Sony Bravia 55&quot; 4K Screen"
            className="border-input h-9 w-56 rounded-md border bg-transparent px-2 text-sm"
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
            <BarcodeScanButton onScan={handleScan} />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs">H/W ID</label>
          <input
            type="text"
            value={hwId}
            onChange={(e) => setHwId(e.target.value)}
            placeholder="Scan, or type"
            className="border-input h-9 w-40 rounded-md border bg-transparent px-2 text-sm"
          />
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
