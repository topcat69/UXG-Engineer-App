"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  createFixtureType,
  createReason,
  deleteFixtureType,
  deleteReason,
  importFixtureTypesCsv,
  importReasonsCsv,
  updateFixtureType,
  updateReason,
  type SlaListRow,
} from "./sla-list-actions";

/**
 * Fixture Type ("what broke", picked by the office when an SLA is
 * created) and Reason ("why", picked by the engineer at completion) —
 * strictly per-customer lists (see 20260907000000_client_sla_lists.sql),
 * each with the same add/edit/delete + CSV bulk-upload shape. Two
 * instances of one reusable section rather than two near-duplicate
 * components, since the only difference between them is which four
 * server actions they call.
 */
export function SlaListsManager({
  clientId,
  fixtureTypes,
  reasons,
}: {
  clientId: string;
  fixtureTypes: SlaListRow[];
  reasons: SlaListRow[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <SlaListSection
        title="SLA Fixture Types"
        description="What can go wrong on an SLA callout for this customer — chosen by the office when a new SLA is created."
        clientId={clientId}
        initialItems={fixtureTypes}
        create={createFixtureType}
        update={updateFixtureType}
        remove={deleteFixtureType}
        importCsv={importFixtureTypesCsv}
      />
      <SlaListSection
        title="SLA Reasons"
        description="Root causes for this customer's SLA callouts — chosen by the engineer once diagnosed on site."
        clientId={clientId}
        initialItems={reasons}
        create={createReason}
        update={updateReason}
        remove={deleteReason}
        importCsv={importReasonsCsv}
      />
    </div>
  );
}

function SlaListSection({
  title,
  description,
  clientId,
  initialItems,
  create,
  update,
  remove,
  importCsv,
}: {
  title: string;
  description: string;
  clientId: string;
  initialItems: SlaListRow[];
  create: (clientId: string, name: string) => Promise<{ ok: true; item: SlaListRow } | { ok: false; message: string }>;
  update: (
    clientId: string,
    itemId: string,
    name: string,
  ) => Promise<{ ok: true; item: SlaListRow } | { ok: false; message: string }>;
  remove: (clientId: string, itemId: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  importCsv: (clientId: string, formData: FormData) => Promise<{ ok: true; message: string } | { ok: false; message: string }>;
}) {
  const [items, setItems] = useState(initialItems);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [isImporting, startImport] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleCreate() {
    startTransition(async () => {
      const result = await create(clientId, name);
      if (result.ok) {
        setItems((prev) => [...prev, result.item].sort((a, b) => a.name.localeCompare(b.name)));
        setName("");
        setMessage(null);
      } else {
        setMessage(result.message);
      }
    });
  }

  function startEdit(item: SlaListRow) {
    setEditingId(item.id);
    setEditName(item.name);
    setMessage(null);
  }

  function handleSaveEdit(itemId: string) {
    startTransition(async () => {
      const result = await update(clientId, itemId, editName);
      if (result.ok) {
        setItems((prev) => prev.map((i) => (i.id === itemId ? result.item : i)).sort((a, b) => a.name.localeCompare(b.name)));
        setEditingId(null);
      } else {
        setMessage(result.message);
      }
    });
  }

  function handleDelete(itemId: string) {
    if (!window.confirm("Delete this? This can't be undone.")) return;
    startTransition(async () => {
      const result = await remove(clientId, itemId);
      if (result.ok) {
        setItems((prev) => prev.filter((i) => i.id !== itemId));
      } else {
        setMessage(result.message);
      }
    });
  }

  function handleImport(formData: FormData) {
    startImport(async () => {
      const result = await importCsv(clientId, formData);
      setImportMessage(result.message);
      if (result.ok && fileInputRef.current) {
        fileInputRef.current.value = "";
        window.location.reload();
      }
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-md border p-3">
      <div>
        <h2 className="font-medium">{title}</h2>
        <p className="text-muted-foreground text-sm">{description}</p>
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

      <form action={handleImport} className="flex items-center gap-2 border-t pt-3">
        <span className="text-muted-foreground text-xs">Or bulk-add from CSV (one required column: name)</span>
        <input ref={fileInputRef} type="file" name="file" accept=".csv,text/csv" required className="text-sm" />
        <Button type="submit" size="sm" variant="outline" disabled={isImporting}>
          {isImporting ? "Importing…" : "Import"}
        </Button>
      </form>
      {importMessage && <p className="text-sm">{importMessage}</p>}
    </section>
  );
}
