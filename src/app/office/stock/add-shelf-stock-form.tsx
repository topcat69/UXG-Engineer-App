"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { addShelfStock } from "./actions";

const OTHER = "__other__";

export function AddShelfStockForm({
  manufacturers,
  models,
}: {
  manufacturers: { id: string; name: string }[];
  models: { id: string; name: string; manufacturer_id: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [manufacturerChoice, setManufacturerChoice] = useState("");
  const [manufacturerOther, setManufacturerOther] = useState("");
  const [modelChoice, setModelChoice] = useState("");
  const [modelOther, setModelOther] = useState("");
  const [quantity, setQuantity] = useState("1");
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
    setQuantity("1");
  }

  function handleAdd() {
    const manufacturer = manufacturerChoice === OTHER ? manufacturerOther : (selectedManufacturer?.name ?? "");
    const model =
      manufacturerChoice === OTHER || modelChoice === OTHER
        ? modelOther
        : (modelsForManufacturer.find((m) => m.id === modelChoice)?.name ?? "");

    startTransition(async () => {
      const result = await addShelfStock(manufacturer, model, Number(quantity));
      if (result.ok) {
        reset();
        setOpen(false);
        setMessage(null);
        router.refresh();
      } else {
        setMessage(result.message);
      }
    });
  }

  if (!open) {
    return (
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        + Add stock
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border bg-muted/40 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs">Manufacturer</label>
          <select
            value={manufacturerChoice}
            onChange={(e) => {
              setManufacturerChoice(e.target.value);
              setModelChoice("");
              setModelOther("");
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
                onChange={(e) => setModelChoice(e.target.value)}
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
          <label className="text-muted-foreground text-xs">Quantity</label>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="border-input h-9 w-24 rounded-md border bg-transparent px-2 text-sm"
          />
        </div>
        <Button type="button" size="sm" disabled={isPending || Number(quantity) < 1} onClick={handleAdd}>
          {isPending ? "Adding…" : "Add to shelf"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Same Manufacturer / Model picklist as the kiosk — pick &quot;Other…&quot; for anything not catalogued yet.
      </p>
      {message && <p className="text-destructive text-sm">{message}</p>}
    </div>
  );
}
