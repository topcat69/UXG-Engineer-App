"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  createCategory,
  createManufacturer,
  createModelRange,
  deleteCategory,
  deleteManufacturer,
  deleteModelRange,
  updateCategory,
  updateManufacturer,
  updateModelRange,
  type KbCategoryRow,
  type KbManufacturerRow,
  type KbModelRangeRow,
} from "./actions";

/**
 * Fixed 3-level tree: Category -> Manufacturer -> Model range (e.g.
 * "Screens" -> "Philips" -> "55in range"). Each level is a flat list
 * fetched from its own table and organised into a tree client-side by
 * parent id, rendered as an expandable list rather than three separate
 * pages — click a category to reveal its manufacturers indented beneath
 * it, click a manufacturer to reveal its model ranges. Add/edit/delete
 * work the same way at every level (mirrors the single-table
 * SlaListSection pattern from office/clients/[id]/sla-lists-manager.tsx,
 * just one level deeper).
 */
export function CategoryManager({
  categories: initialCategories,
  manufacturers: initialManufacturers,
  modelRanges: initialModelRanges,
}: {
  categories: KbCategoryRow[];
  manufacturers: KbManufacturerRow[];
  modelRanges: KbModelRangeRow[];
}) {
  const [categories, setCategories] = useState(initialCategories);
  const [manufacturers, setManufacturers] = useState(initialManufacturers);
  const [modelRanges, setModelRanges] = useState(initialModelRanges);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedManufacturers, setExpandedManufacturers] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);

  function toggleCategory(id: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleManufacturer(id: string) {
    setExpandedManufacturers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-md border p-3">
      <div>
        <h2 className="font-medium">Categories</h2>
        <p className="text-muted-foreground text-sm">
          Category → Manufacturer → Model range. An article can be filed at any level — expand a category to manage
          its manufacturers, and a manufacturer to manage its model ranges.
        </p>
      </div>
      {message && <p className="text-destructive text-sm">{message}</p>}
      <ul className="flex flex-col gap-1">
        {categories.map((category) => (
          <CategoryNode
            key={category.id}
            category={category}
            manufacturers={manufacturers.filter((m) => m.category_id === category.id)}
            modelRanges={modelRanges}
            expanded={expandedCategories.has(category.id)}
            expandedManufacturers={expandedManufacturers}
            onToggle={() => toggleCategory(category.id)}
            onToggleManufacturer={toggleManufacturer}
            onCategoriesChange={setCategories}
            onManufacturersChange={setManufacturers}
            onModelRangesChange={setModelRanges}
            onError={setMessage}
          />
        ))}
        {categories.length === 0 && <li className="text-muted-foreground py-2 text-sm">No categories yet.</li>}
      </ul>
      <AddForm placeholder="New category name" onAdd={async (name) => createCategory(name)} onAdded={(item) => setCategories((prev) => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)))} onError={setMessage} />
    </section>
  );
}

function CategoryNode({
  category,
  manufacturers,
  modelRanges,
  expanded,
  expandedManufacturers,
  onToggle,
  onToggleManufacturer,
  onCategoriesChange,
  onManufacturersChange,
  onModelRangesChange,
  onError,
}: {
  category: KbCategoryRow;
  manufacturers: KbManufacturerRow[];
  modelRanges: KbModelRangeRow[];
  expanded: boolean;
  expandedManufacturers: Set<string>;
  onToggle: () => void;
  onToggleManufacturer: (id: string) => void;
  onCategoriesChange: React.Dispatch<React.SetStateAction<KbCategoryRow[]>>;
  onManufacturersChange: React.Dispatch<React.SetStateAction<KbManufacturerRow[]>>;
  onModelRangesChange: React.Dispatch<React.SetStateAction<KbModelRangeRow[]>>;
  onError: (message: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(category.name);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await updateCategory(category.id, editName);
      if (result.ok) {
        onCategoriesChange((prev) => prev.map((c) => (c.id === category.id ? result.item : c)).sort((a, b) => a.name.localeCompare(b.name)));
        setEditing(false);
      } else {
        onError(result.message);
      }
    });
  }

  function handleDelete() {
    if (!window.confirm(`Delete "${category.name}"? This can't be undone.`)) return;
    startTransition(async () => {
      const result = await deleteCategory(category.id);
      if (result.ok) onCategoriesChange((prev) => prev.filter((c) => c.id !== category.id));
      else onError(result.message);
    });
  }

  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onToggle} className="text-muted-foreground w-4 text-xs">
          {expanded ? "▾" : "▸"}
        </button>
        {editing ? (
          <>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="border-input h-8 rounded-md border bg-transparent px-2 text-sm"
            />
            <Button type="button" size="sm" disabled={isPending || !editName.trim()} onClick={handleSave}>
              Save
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <span className="flex-1 font-medium">{category.name}</span>
            <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={handleDelete}>
              Delete
            </Button>
          </>
        )}
      </div>

      {expanded && (
        <div className="ml-6 flex flex-col gap-1 border-l pl-3">
          <ul className="flex flex-col gap-1">
            {manufacturers.map((manufacturer) => (
              <ManufacturerNode
                key={manufacturer.id}
                manufacturer={manufacturer}
                modelRanges={modelRanges.filter((r) => r.manufacturer_id === manufacturer.id)}
                expanded={expandedManufacturers.has(manufacturer.id)}
                onToggle={() => onToggleManufacturer(manufacturer.id)}
                onManufacturersChange={onManufacturersChange}
                onModelRangesChange={onModelRangesChange}
                onError={onError}
              />
            ))}
            {manufacturers.length === 0 && <li className="text-muted-foreground py-1 text-xs">No manufacturers yet.</li>}
          </ul>
          <AddForm
            small
            placeholder="New manufacturer name"
            onAdd={(name) => createManufacturer(category.id, name)}
            onAdded={(item) => onManufacturersChange((prev) => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)))}
            onError={onError}
          />
        </div>
      )}
    </li>
  );
}

function ManufacturerNode({
  manufacturer,
  modelRanges,
  expanded,
  onToggle,
  onManufacturersChange,
  onModelRangesChange,
  onError,
}: {
  manufacturer: KbManufacturerRow;
  modelRanges: KbModelRangeRow[];
  expanded: boolean;
  onToggle: () => void;
  onManufacturersChange: React.Dispatch<React.SetStateAction<KbManufacturerRow[]>>;
  onModelRangesChange: React.Dispatch<React.SetStateAction<KbModelRangeRow[]>>;
  onError: (message: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(manufacturer.name);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await updateManufacturer(manufacturer.id, editName);
      if (result.ok) {
        onManufacturersChange((prev) => prev.map((m) => (m.id === manufacturer.id ? result.item : m)).sort((a, b) => a.name.localeCompare(b.name)));
        setEditing(false);
      } else {
        onError(result.message);
      }
    });
  }

  function handleDelete() {
    if (!window.confirm(`Delete "${manufacturer.name}"? This can't be undone.`)) return;
    startTransition(async () => {
      const result = await deleteManufacturer(manufacturer.id);
      if (result.ok) onManufacturersChange((prev) => prev.filter((m) => m.id !== manufacturer.id));
      else onError(result.message);
    });
  }

  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onToggle} className="text-muted-foreground w-4 text-xs">
          {expanded ? "▾" : "▸"}
        </button>
        {editing ? (
          <>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="border-input h-8 rounded-md border bg-transparent px-2 text-sm"
            />
            <Button type="button" size="sm" disabled={isPending || !editName.trim()} onClick={handleSave}>
              Save
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <span className="flex-1 text-sm">{manufacturer.name}</span>
            <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={handleDelete}>
              Delete
            </Button>
          </>
        )}
      </div>

      {expanded && (
        <div className="ml-6 flex flex-col gap-1 border-l pl-3">
          <ul className="flex flex-col gap-1">
            {modelRanges.map((range) => (
              <ModelRangeNode key={range.id} modelRange={range} onModelRangesChange={onModelRangesChange} onError={onError} />
            ))}
            {modelRanges.length === 0 && <li className="text-muted-foreground py-1 text-xs">No model ranges yet.</li>}
          </ul>
          <AddForm
            small
            placeholder="New model range name"
            onAdd={(name) => createModelRange(manufacturer.id, name)}
            onAdded={(item) => onModelRangesChange((prev) => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)))}
            onError={onError}
          />
        </div>
      )}
    </li>
  );
}

function ModelRangeNode({
  modelRange,
  onModelRangesChange,
  onError,
}: {
  modelRange: KbModelRangeRow;
  onModelRangesChange: React.Dispatch<React.SetStateAction<KbModelRangeRow[]>>;
  onError: (message: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(modelRange.name);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await updateModelRange(modelRange.id, editName);
      if (result.ok) {
        onModelRangesChange((prev) => prev.map((r) => (r.id === modelRange.id ? result.item : r)).sort((a, b) => a.name.localeCompare(b.name)));
        setEditing(false);
      } else {
        onError(result.message);
      }
    });
  }

  function handleDelete() {
    if (!window.confirm(`Delete "${modelRange.name}"? This can't be undone.`)) return;
    startTransition(async () => {
      const result = await deleteModelRange(modelRange.id);
      if (result.ok) onModelRangesChange((prev) => prev.filter((r) => r.id !== modelRange.id));
      else onError(result.message);
    });
  }

  return (
    <li className="flex items-center gap-2">
      {editing ? (
        <>
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="border-input h-8 rounded-md border bg-transparent px-2 text-sm"
          />
          <Button type="button" size="sm" disabled={isPending || !editName.trim()} onClick={handleSave}>
            Save
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </>
      ) : (
        <>
          <span className="flex-1 text-sm">{modelRange.name}</span>
          <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={handleDelete}>
            Delete
          </Button>
        </>
      )}
    </li>
  );
}

/** Shared little inline "add new row" form used at all three levels. */
function AddForm<T>({
  placeholder,
  small,
  onAdd,
  onAdded,
  onError,
}: {
  placeholder: string;
  small?: boolean;
  onAdd: (name: string) => Promise<{ ok: true; item: T } | { ok: false; message: string }>;
  onAdded: (item: T) => void;
  onError: (message: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    startTransition(async () => {
      const result = await onAdd(name);
      if (result.ok) {
        onAdded(result.item);
        setName("");
        onError(null);
      } else {
        onError(result.message);
      }
    });
  }

  return (
    <div className="flex items-end gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={placeholder}
        className={`border-input rounded-md border bg-transparent px-2 text-sm ${small ? "h-8" : "h-9"}`}
      />
      <Button type="button" size="sm" disabled={isPending || !name.trim()} onClick={handleAdd}>
        Add
      </Button>
    </div>
  );
}
