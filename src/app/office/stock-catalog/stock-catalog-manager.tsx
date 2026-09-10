"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  createManufacturer,
  createModel,
  deleteManufacturer,
  deleteModel,
  updateManufacturer,
  updateModel,
  type StockListRow,
  type StockModelRow,
} from "./actions";

/**
 * Predefined Manufacturer/Model picklists behind the kiosk's goods-in
 * dropdowns (see add-stock-item-form.tsx) — a manufacturer on the left,
 * its models on the right once selected, same add/edit/delete shape as
 * SlaListsManager but cascading rather than two independent flat lists.
 */
export function StockCatalogManager({
  initialManufacturers,
  initialModels,
}: {
  initialManufacturers: StockListRow[];
  initialModels: StockModelRow[];
}) {
  const [manufacturers, setManufacturers] = useState(initialManufacturers);
  const [models, setModels] = useState(initialModels);
  const [selectedId, setSelectedId] = useState<string | null>(initialManufacturers[0]?.id ?? null);

  const selectedManufacturer = manufacturers.find((m) => m.id === selectedId) ?? null;
  const modelsForSelected = models.filter((m) => m.manufacturer_id === selectedId);

  function handleManufacturerDeleted(id: string) {
    setManufacturers((prev) => prev.filter((m) => m.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      <ManufacturerSection
        manufacturers={manufacturers}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onCreated={(item) => setManufacturers((prev) => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)))}
        onUpdated={(item) => setManufacturers((prev) => prev.map((m) => (m.id === item.id ? item : m)).sort((a, b) => a.name.localeCompare(b.name)))}
        onDeleted={handleManufacturerDeleted}
      />
      <ModelSection
        manufacturer={selectedManufacturer}
        models={modelsForSelected}
        onCreated={(item) => setModels((prev) => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)))}
        onUpdated={(item) => setModels((prev) => prev.map((m) => (m.id === item.id ? item : m)).sort((a, b) => a.name.localeCompare(b.name)))}
        onDeleted={(id) => setModels((prev) => prev.filter((m) => m.id !== id))}
      />
    </div>
  );
}

function ManufacturerSection({
  manufacturers,
  selectedId,
  onSelect,
  onCreated,
  onUpdated,
  onDeleted,
}: {
  manufacturers: StockListRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreated: (item: StockListRow) => void;
  onUpdated: (item: StockListRow) => void;
  onDeleted: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  function handleCreate() {
    startTransition(async () => {
      const result = await createManufacturer(name);
      if (result.ok) {
        onCreated(result.item);
        setName("");
        setMessage(null);
      } else {
        setMessage(result.message);
      }
    });
  }

  function handleSaveEdit(id: string) {
    startTransition(async () => {
      const result = await updateManufacturer(id, editName);
      if (result.ok) {
        onUpdated(result.item);
        setEditingId(null);
      } else {
        setMessage(result.message);
      }
    });
  }

  function handleDelete(id: string) {
    if (!window.confirm("Delete this manufacturer? This can't be undone.")) return;
    startTransition(async () => {
      const result = await deleteManufacturer(id);
      if (result.ok) {
        onDeleted(id);
      } else {
        setMessage(result.message);
      }
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-md border p-3">
      <div>
        <h2 className="font-medium">Manufacturers</h2>
        <p className="text-muted-foreground text-sm">Pick one to manage its models on the right.</p>
      </div>

      <table className="w-full text-sm">
        <tbody>
          {manufacturers.map((item) =>
            editingId === item.id ? (
              <tr key={item.id} className="border-b">
                <td className="py-2">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="border-input h-8 w-full rounded-md border bg-transparent px-2 text-sm"
                  />
                </td>
                <td className="py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <Button type="button" size="sm" disabled={isPending || !editName.trim()} onClick={() => handleSaveEdit(item.id)}>
                      Save
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={item.id} className={`border-b ${item.id === selectedId ? "bg-muted/40" : ""}`}>
                <td className="py-2">
                  <button type="button" onClick={() => onSelect(item.id)} className="text-left hover:underline">
                    {item.name}
                  </button>
                </td>
                <td className="py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => {
                        setEditingId(item.id);
                        setEditName(item.name);
                        setMessage(null);
                      }}
                    >
                      Edit
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => handleDelete(item.id)}>
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ),
          )}
          {manufacturers.length === 0 && (
            <tr>
              <td colSpan={2} className="text-muted-foreground py-4 text-center">
                None yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {message && <p className="text-destructive text-sm">{message}</p>}

      <div className="flex items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
          />
        </div>
        <Button type="button" size="sm" disabled={isPending || !name.trim()} onClick={handleCreate}>
          Add
        </Button>
      </div>
    </section>
  );
}

function ModelSection({
  manufacturer,
  models,
  onCreated,
  onUpdated,
  onDeleted,
}: {
  manufacturer: StockListRow | null;
  models: StockModelRow[];
  onCreated: (item: StockModelRow) => void;
  onUpdated: (item: StockModelRow) => void;
  onDeleted: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  function handleCreate() {
    if (!manufacturer) return;
    startTransition(async () => {
      const result = await createModel(manufacturer.id, name);
      if (result.ok) {
        onCreated(result.item);
        setName("");
        setMessage(null);
      } else {
        setMessage(result.message);
      }
    });
  }

  function handleSaveEdit(id: string) {
    startTransition(async () => {
      const result = await updateModel(id, editName);
      if (result.ok) {
        onUpdated(result.item);
        setEditingId(null);
      } else {
        setMessage(result.message);
      }
    });
  }

  function handleDelete(id: string) {
    if (!window.confirm("Delete this model? This can't be undone.")) return;
    startTransition(async () => {
      const result = await deleteModel(id);
      if (result.ok) {
        onDeleted(id);
      } else {
        setMessage(result.message);
      }
    });
  }

  if (!manufacturer) {
    return (
      <section className="flex flex-col gap-3 rounded-md border p-3">
        <h2 className="font-medium">Models</h2>
        <p className="text-muted-foreground text-sm">Select a manufacturer on the left first.</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-md border p-3">
      <div>
        <h2 className="font-medium">Models — {manufacturer.name}</h2>
      </div>

      <table className="w-full text-sm">
        <tbody>
          {models.map((item) =>
            editingId === item.id ? (
              <tr key={item.id} className="border-b">
                <td className="py-2">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="border-input h-8 w-full rounded-md border bg-transparent px-2 text-sm"
                  />
                </td>
                <td className="py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <Button type="button" size="sm" disabled={isPending || !editName.trim()} onClick={() => handleSaveEdit(item.id)}>
                      Save
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={item.id} className="border-b">
                <td className="py-2">{item.name}</td>
                <td className="py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => {
                        setEditingId(item.id);
                        setEditName(item.name);
                        setMessage(null);
                      }}
                    >
                      Edit
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => handleDelete(item.id)}>
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ),
          )}
          {models.length === 0 && (
            <tr>
              <td colSpan={2} className="text-muted-foreground py-4 text-center">
                None yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {message && <p className="text-destructive text-sm">{message}</p>}

      <div className="flex items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
          />
        </div>
        <Button type="button" size="sm" disabled={isPending || !name.trim()} onClick={handleCreate}>
          Add
        </Button>
      </div>
    </section>
  );
}
