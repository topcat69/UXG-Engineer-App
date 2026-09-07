"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createCategory, deleteCategory, updateCategory, type KbCategoryRow } from "./actions";

export function CategoryManager({ categories: initialCategories }: { categories: KbCategoryRow[] }) {
  const [categories, setCategories] = useState(initialCategories);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  function handleCreate() {
    startTransition(async () => {
      const result = await createCategory(name);
      if (result.ok) {
        setCategories((prev) => [...prev, result.item].sort((a, b) => a.name.localeCompare(b.name)));
        setName("");
        setMessage(null);
      } else {
        setMessage(result.message);
      }
    });
  }

  function startEdit(item: KbCategoryRow) {
    setEditingId(item.id);
    setEditName(item.name);
    setMessage(null);
  }

  function handleSaveEdit(categoryId: string) {
    startTransition(async () => {
      const result = await updateCategory(categoryId, editName);
      if (result.ok) {
        setCategories((prev) => prev.map((c) => (c.id === categoryId ? result.item : c)).sort((a, b) => a.name.localeCompare(b.name)));
        setEditingId(null);
      } else {
        setMessage(result.message);
      }
    });
  }

  function handleDelete(categoryId: string) {
    if (!window.confirm("Delete this category? This can't be undone.")) return;
    startTransition(async () => {
      const result = await deleteCategory(categoryId);
      if (result.ok) {
        setCategories((prev) => prev.filter((c) => c.id !== categoryId));
      } else {
        setMessage(result.message);
      }
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-md border p-3">
      <div>
        <h2 className="font-medium">Categories</h2>
        <p className="text-muted-foreground text-sm">Seeded from the existing job types — add, rename, or remove at any time.</p>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {categories.map((item) =>
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
                    <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => startEdit(item)}>
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
          {categories.length === 0 && (
            <tr>
              <td colSpan={2} className="text-muted-foreground py-4 text-center">
                No categories yet.
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
