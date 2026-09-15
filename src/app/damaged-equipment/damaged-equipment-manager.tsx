"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { humanize } from "@/lib/format/text";
import type { Database } from "@/lib/supabase/database.types";
import { createDamagedEquipment, deleteDamagedEquipment, updateDamagedEquipmentNextStep } from "./actions";
import { DamagedEquipmentPhotoControl } from "./damaged-equipment-photo-control";

const OTHER = "__other__";

type DamageResolution = Database["public"]["Enums"]["damage_resolution"];
const NEXT_STEPS: DamageResolution[] = ["pending", "replace", "warranty_claim", "repair", "write_off", "other"];

type ClientOption = { id: string; name: string };
type SiteOption = { id: string; name: string; client_id: string };
type Manufacturer = { id: string; name: string };
type Model = { id: string; name: string; manufacturer_id: string; description: string | null };

type DamagedItem = {
  id: string;
  manufacturer: string | null;
  model: string | null;
  description: string | null;
  serial_number: string | null;
  site_id: string | null;
  damage_notes: string | null;
  next_step: DamageResolution;
  photo_path: string | null;
  photoUrl: string | null;
  created_at: string;
  site: { name: string; client: { name: string } | null } | null;
};

function itemLabel(item: DamagedItem): string {
  const parts = [item.manufacturer, item.model].filter(Boolean).join(" ");
  return item.serial_number ? `${parts || "—"} — ${item.serial_number}` : parts || "—";
}

const EMPTY_FORM = { serialNumber: "", siteId: "", damageNotes: "" };

export function DamagedEquipmentManager({
  initialItems,
  clients,
  sites,
  manufacturers,
  models,
  canDelete,
}: {
  initialItems: DamagedItem[];
  clients: ClientOption[];
  sites: SiteOption[];
  manufacturers: Manufacturer[];
  models: Model[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [clientId, setClientId] = useState("");
  const [manufacturerChoice, setManufacturerChoice] = useState("");
  const [manufacturerOther, setManufacturerOther] = useState("");
  const [modelChoice, setModelChoice] = useState("");
  const [modelOther, setModelOther] = useState("");
  const [description, setDescription] = useState("");
  const [isAdding, startAddTransition] = useTransition();

  // Same Client -> Site cascade as the SLA creation form — a flat, unscoped
  // site list was the actual bug report: two clients can each have a
  // "Site 1", and there was no way to tell them apart or narrow the list.
  const clientSites = useMemo(() => sites.filter((s) => s.client_id === clientId), [sites, clientId]);
  const selectedManufacturer = manufacturers.find((m) => m.id === manufacturerChoice);
  const modelsForManufacturer = useMemo(
    () => (selectedManufacturer ? models.filter((m) => m.manufacturer_id === selectedManufacturer.id) : []),
    [models, selectedManufacturer],
  );

  function resetForm() {
    setForm(EMPTY_FORM);
    setClientId("");
    setManufacturerChoice("");
    setManufacturerOther("");
    setModelChoice("");
    setModelOther("");
    setDescription("");
  }

  function handleNextStepChange(id: string, value: DamageResolution) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, next_step: value } : i)));
    startTransition(async () => {
      const result = await updateDamagedEquipmentNextStep(id, value);
      if (!result.ok) setMessage(result.message);
    });
  }

  function handleDelete(id: string) {
    if (!window.confirm("Delete this damaged equipment record? This can't be undone.")) return;
    startTransition(async () => {
      const result = await deleteDamagedEquipment(id);
      if (result.ok) {
        setItems((prev) => prev.filter((i) => i.id !== id));
      } else {
        setMessage(result.message);
      }
    });
  }

  function handleAdd() {
    const manufacturer = manufacturerChoice === OTHER ? manufacturerOther : (selectedManufacturer?.name ?? "");
    const model =
      manufacturerChoice === OTHER || modelChoice === OTHER
        ? modelOther
        : (modelsForManufacturer.find((m) => m.id === modelChoice)?.name ?? "");

    startAddTransition(async () => {
      const result = await createDamagedEquipment({ ...form, manufacturer, model, description });
      if (result.ok) {
        resetForm();
        setShowAddForm(false);
        router.refresh();
      } else {
        setMessage(result.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        {showAddForm ? (
          <div className="flex flex-col gap-3 rounded-md border bg-muted/40 p-3">
            <h2 className="font-medium">Log damaged equipment</h2>
            <p className="text-muted-foreground text-xs">
              For something damaged outside of goods-in — e.g. it fell off a shelf in the warehouse.
            </p>
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
              <LabeledInput label="Description" value={description} onChange={setDescription} />
              <LabeledInput label="Serial number" value={form.serialNumber} onChange={(v) => setForm({ ...form, serialNumber: v })} />
              <div className="flex flex-col gap-1">
                <label className="text-muted-foreground text-xs">Client</label>
                <select
                  value={clientId}
                  onChange={(e) => {
                    setClientId(e.target.value);
                    setForm({ ...form, siteId: "" });
                  }}
                  className="border-input h-9 w-44 rounded-md border bg-transparent px-2 text-sm"
                >
                  <option value="">Select…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-muted-foreground text-xs">Site</label>
                <select
                  value={form.siteId}
                  onChange={(e) => setForm({ ...form, siteId: e.target.value })}
                  disabled={!clientId}
                  className="border-input h-9 w-56 rounded-md border bg-transparent px-2 text-sm"
                >
                  <option value="">{clientId ? "Select…" : "Pick a client first"}</option>
                  {clientSites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">Damage notes</label>
              <textarea
                value={form.damageNotes}
                onChange={(e) => setForm({ ...form, damageNotes: e.target.value })}
                rows={3}
                className="border-input rounded-md border bg-transparent px-2 py-1.5 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" disabled={isAdding} onClick={handleAdd}>
                {isAdding ? "Adding…" : "Add damaged item"}
              </Button>
              <Button type="button" variant="outline" disabled={isAdding} onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button type="button" onClick={() => setShowAddForm(true)}>
            Log damaged equipment
          </Button>
        )}
      </div>

      {message && <p className="text-destructive text-sm">{message}</p>}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 font-medium">Item</th>
            <th className="py-2 font-medium">Client</th>
            <th className="py-2 font-medium">Site</th>
            <th className="py-2 font-medium">Damage notes</th>
            <th className="py-2 font-medium">Next step</th>
            <th className="py-2 font-medium">Reported</th>
            <th className="py-2 font-medium">Photo</th>
            {canDelete && <th className="py-2 font-medium">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr>
              <td colSpan={canDelete ? 8 : 7} className="text-muted-foreground py-6 text-center">
                Nothing logged yet.
              </td>
            </tr>
          )}
          {items.map((item) => (
            <tr key={item.id} className="border-b align-top">
              <td className="py-2">{itemLabel(item)}</td>
              <td className="py-2 text-muted-foreground">{item.site?.client?.name ?? "—"}</td>
              <td className="py-2 text-muted-foreground">{item.site?.name ?? "—"}</td>
              <td className="py-2 text-muted-foreground max-w-xs">{item.damage_notes ?? "—"}</td>
              <td className="py-2">
                <select
                  value={item.next_step}
                  disabled={isPending}
                  onChange={(e) => handleNextStepChange(item.id, e.target.value as DamageResolution)}
                  className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
                >
                  {NEXT_STEPS.map((s) => (
                    <option key={s} value={s}>
                      {humanize(s)}
                    </option>
                  ))}
                </select>
              </td>
              <td className="py-2 text-muted-foreground">{new Date(item.created_at).toLocaleString()}</td>
              <td className="py-2">
                <DamagedEquipmentPhotoControl id={item.id} photoPath={item.photo_path} photoUrl={item.photoUrl} />
              </td>
              {canDelete && (
                <td className="py-2">
                  <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => handleDelete(item.id)}>
                    Delete
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LabeledInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-muted-foreground text-xs">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-input h-9 w-44 rounded-md border bg-transparent px-2 text-sm"
      />
    </div>
  );
}
