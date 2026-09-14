"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { humanize } from "@/lib/format/text";
import type { Database } from "@/lib/supabase/database.types";
import { createDamagedEquipment, deleteDamagedEquipment, updateDamagedEquipmentNextStep } from "./actions";
import { DamagedEquipmentPhotoControl } from "./damaged-equipment-photo-control";

type DamageResolution = Database["public"]["Enums"]["damage_resolution"];
const NEXT_STEPS: DamageResolution[] = ["pending", "replace", "warranty_claim", "repair", "write_off", "other"];

type SiteOption = { id: string; name: string; client: { name: string } | null };

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

const EMPTY_FORM = { manufacturer: "", model: "", description: "", serialNumber: "", siteId: "", damageNotes: "" };

export function DamagedEquipmentManager({
  initialItems,
  sites,
  canDelete,
}: {
  initialItems: DamagedItem[];
  sites: SiteOption[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isAdding, startAddTransition] = useTransition();

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
    startAddTransition(async () => {
      const result = await createDamagedEquipment(form);
      if (result.ok) {
        setForm(EMPTY_FORM);
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
              <LabeledInput label="Manufacturer" value={form.manufacturer} onChange={(v) => setForm({ ...form, manufacturer: v })} />
              <LabeledInput label="Model" value={form.model} onChange={(v) => setForm({ ...form, model: v })} />
              <LabeledInput label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
              <LabeledInput label="Serial number" value={form.serialNumber} onChange={(v) => setForm({ ...form, serialNumber: v })} />
              <div className="flex flex-col gap-1">
                <label className="text-muted-foreground text-xs">Site</label>
                <select
                  value={form.siteId}
                  onChange={(e) => setForm({ ...form, siteId: e.target.value })}
                  className="border-input h-9 w-56 rounded-md border bg-transparent px-2 text-sm"
                >
                  <option value="">Unassigned</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.client ? `${s.name} — ${s.client.name}` : s.name}
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
