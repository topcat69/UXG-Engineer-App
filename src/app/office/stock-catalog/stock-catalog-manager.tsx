"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FlatListSection } from "@/components/office/flat-list-section";
import {
  createManufacturer,
  createModel,
  createSoftwareProvider,
  deleteManufacturer,
  deleteModel,
  deleteSoftwareProvider,
  updateManufacturer,
  updateModel,
  updateSoftwareProvider,
  type ManufacturerRow,
  type StockListRow,
  type StockModelRow,
} from "./actions";

/**
 * Predefined Manufacturer/Model picklists behind the kiosk's goods-in
 * dropdowns (see add-stock-item-form.tsx) — a manufacturer on the left,
 * its models on the right once selected, same add/edit/delete shape as
 * SlaListsManager but cascading rather than two independent flat lists.
 * Software Providers is a third, independent flat list — same shape as
 * Manufacturers (FlatListSection), just with nothing cascading under it.
 */
export function StockCatalogManager({
  initialManufacturers,
  initialModels,
  initialSoftwareProviders,
  assetCategories,
}: {
  initialManufacturers: ManufacturerRow[];
  initialModels: StockModelRow[];
  initialSoftwareProviders: StockListRow[];
  assetCategories: StockListRow[];
}) {
  const [manufacturers, setManufacturers] = useState(initialManufacturers);
  const [models, setModels] = useState(initialModels);
  const [selectedId, setSelectedId] = useState<string | null>(initialManufacturers[0]?.id ?? null);
  const [softwareProviders, setSoftwareProviders] = useState(initialSoftwareProviders);

  const selectedManufacturer = manufacturers.find((m) => m.id === selectedId) ?? null;
  const modelsForSelected = models.filter((m) => m.manufacturer_id === selectedId);

  function handleManufacturerDeleted(id: string) {
    setManufacturers((prev) => prev.filter((m) => m.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-6">
        <ManufacturerSection
          manufacturers={manufacturers}
          assetCategories={assetCategories}
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
      <FlatListSection
        title="Software Providers"
        helperText="Providers of software/platforms used on installs — e.g. signage CMS vendors."
        items={softwareProviders}
        create={createSoftwareProvider}
        update={updateSoftwareProvider}
        remove={deleteSoftwareProvider}
        onCreated={(item) => setSoftwareProviders((prev) => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)))}
        onUpdated={(item) => setSoftwareProviders((prev) => prev.map((p) => (p.id === item.id ? item : p)).sort((a, b) => a.name.localeCompare(b.name)))}
        onDeleted={(id) => setSoftwareProviders((prev) => prev.filter((p) => p.id !== id))}
        confirmDeleteText="Delete this software provider? This can't be undone."
      />
    </div>
  );
}

/**
 * Manufacturers, each optionally tagged with the Asset Register category
 * its kit falls under — picking one here bulk-categorises every
 * currently-uncategorised Asset Register row with a matching manufacturer
 * (see createManufacturer/updateManufacturer). Bespoke rather than
 * FlatListSection (used for Software Providers/Asset Categories) since
 * this list carries that extra category field plus the row-select driving
 * the Models section next to it.
 */
function ManufacturerSection({
  manufacturers,
  assetCategories,
  selectedId,
  onSelect,
  onCreated,
  onUpdated,
  onDeleted,
}: {
  manufacturers: ManufacturerRow[];
  assetCategories: StockListRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreated: (item: ManufacturerRow) => void;
  onUpdated: (item: ManufacturerRow) => void;
  onDeleted: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");

  function categoryName(id: string | null) {
    return assetCategories.find((c) => c.id === id)?.name ?? null;
  }

  function handleCreate() {
    startTransition(async () => {
      const result = await createManufacturer(name, categoryId || null);
      if (result.ok) {
        onCreated(result.item);
        setName("");
        setCategoryId("");
        setMessage(null);
      } else {
        setMessage(result.message);
      }
    });
  }

  function handleSaveEdit(id: string) {
    startTransition(async () => {
      const result = await updateManufacturer(id, editName, editCategoryId || null);
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
        <p className="text-muted-foreground text-sm">
          Pick one to manage its models on the right. A category here bulk-fills any uncategorised Asset Register
          entries for that manufacturer.
        </p>
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
                <td className="py-2">
                  <select
                    value={editCategoryId}
                    onChange={(e) => setEditCategoryId(e.target.value)}
                    className="border-input h-8 w-full rounded-md border bg-transparent px-2 text-sm"
                  >
                    <option value="">No category</option>
                    {assetCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
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
                <td className="text-muted-foreground py-2">{categoryName(item.category_id) ?? "—"}</td>
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
                        setEditCategoryId(item.category_id ?? "");
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
              <td colSpan={3} className="text-muted-foreground py-4 text-center">
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
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs">Asset category</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
          >
            <option value="">No category</option>
            {assetCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
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
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  function handleCreate() {
    if (!manufacturer) return;
    startTransition(async () => {
      const result = await createModel(manufacturer.id, name, description);
      if (result.ok) {
        onCreated(result.item);
        setName("");
        setDescription("");
        setMessage(null);
      } else {
        setMessage(result.message);
      }
    });
  }

  function handleSaveEdit(id: string) {
    startTransition(async () => {
      const result = await updateModel(id, editName, editDescription);
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
                    placeholder="Name"
                    className="border-input h-8 w-full rounded-md border bg-transparent px-2 text-sm"
                  />
                </td>
                <td className="py-2">
                  <input
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Description"
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
                <td className="text-muted-foreground py-2">{item.description ?? "—"}</td>
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
                        setEditDescription(item.description ?? "");
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
              <td colSpan={3} className="text-muted-foreground py-4 text-center">
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
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs">Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Sony Bravia 55&quot; 4K Screen"
            className="border-input h-9 w-56 rounded-md border bg-transparent px-2 text-sm"
          />
        </div>
        <Button type="button" size="sm" disabled={isPending || !name.trim()} onClick={handleCreate}>
          Add
        </Button>
      </div>
    </section>
  );
}
