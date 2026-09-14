"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

export type NamedListRow = { id: string; name: string };
export type NamedItemResult = { ok: true; item: NamedListRow } | { ok: false; message: string };
export type NamedDeleteResult = { ok: true } | { ok: false; message: string };

/**
 * A flat, independently add/edit/delete-able picklist — e.g. Stock
 * Catalog's Manufacturers/Software Providers, or Asset Register's
 * Categories. Extracted out of stock-catalog-manager.tsx so every flat
 * catalog list in the app shares one implementation. `selectedId`/
 * `onSelect` are optional — only Manufacturers (driving the Models
 * section next to it) uses them.
 */
export function FlatListSection({
  title,
  helperText,
  items,
  selectedId,
  onSelect,
  create,
  update,
  remove,
  onCreated,
  onUpdated,
  onDeleted,
  confirmDeleteText,
}: {
  title: string;
  helperText: string;
  items: NamedListRow[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  create: (name: string) => Promise<NamedItemResult>;
  update: (id: string, name: string) => Promise<NamedItemResult>;
  remove: (id: string) => Promise<NamedDeleteResult>;
  onCreated: (item: NamedListRow) => void;
  onUpdated: (item: NamedListRow) => void;
  onDeleted: (id: string) => void;
  confirmDeleteText: string;
}) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  function handleCreate() {
    startTransition(async () => {
      const result = await create(name);
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
      const result = await update(id, editName);
      if (result.ok) {
        onUpdated(result.item);
        setEditingId(null);
      } else {
        setMessage(result.message);
      }
    });
  }

  function handleDelete(id: string) {
    if (!window.confirm(confirmDeleteText)) return;
    startTransition(async () => {
      const result = await remove(id);
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
        <h2 className="font-medium">{title}</h2>
        <p className="text-muted-foreground text-sm">{helperText}</p>
      </div>

      <table className="w-full text-sm">
        <tbody>
          {items.map((item) =>
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
                  {onSelect ? (
                    <button type="button" onClick={() => onSelect(item.id)} className="text-left hover:underline">
                      {item.name}
                    </button>
                  ) : (
                    item.name
                  )}
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
          {items.length === 0 && (
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
