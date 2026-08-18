"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createClientRecord, deleteClientRecord, importClientsCsv, updateClientRecord, type ClientRow } from "./actions";

type EditFields = { name: string; contact_name: string; contact_email: string; contact_phone: string };

function toEditFields(c: ClientRow): EditFields {
  return {
    name: c.name,
    contact_name: c.contact_name ?? "",
    contact_email: c.contact_email ?? "",
    contact_phone: c.contact_phone ?? "",
  };
}

export function ClientsManager({
  clients: initialClients,
  siteCounts,
}: {
  clients: ClientRow[];
  siteCounts: Record<string, number>;
}) {
  const [clients, setClients] = useState(initialClients);
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<EditFields>({ name: "", contact_name: "", contact_email: "", contact_phone: "" });
  const [rowMessage, setRowMessage] = useState<string | null>(null);

  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [isImporting, startImport] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleCreate() {
    startTransition(async () => {
      const result = await createClientRecord({
        name,
        contact_name: contactName,
        contact_email: contactEmail,
        contact_phone: contactPhone,
      });
      if (result.ok) {
        setClients((prev) => [...prev, result.client].sort((a, b) => a.name.localeCompare(b.name)));
        setName("");
        setContactName("");
        setContactEmail("");
        setContactPhone("");
        setMessage(`${result.client.name} added.`);
      } else {
        setMessage(result.message);
      }
    });
  }

  function startEdit(c: ClientRow) {
    setEditingId(c.id);
    setEditFields(toEditFields(c));
    setRowMessage(null);
  }

  function handleSaveEdit(clientId: string) {
    startTransition(async () => {
      const result = await updateClientRecord(clientId, {
        name: editFields.name,
        contact_name: editFields.contact_name,
        contact_email: editFields.contact_email,
        contact_phone: editFields.contact_phone,
      });
      if (result.ok) {
        setClients((prev) => prev.map((c) => (c.id === clientId ? result.client : c)).sort((a, b) => a.name.localeCompare(b.name)));
        setEditingId(null);
      } else {
        setRowMessage(result.message);
      }
    });
  }

  function handleDelete(clientId: string) {
    if (!window.confirm("Delete this client? This can't be undone.")) return;
    startTransition(async () => {
      const result = await deleteClientRecord(clientId);
      if (result.ok) {
        setClients((prev) => prev.filter((c) => c.id !== clientId));
      } else {
        setRowMessage(result.message);
      }
    });
  }

  function handleImport(formData: FormData) {
    startImport(async () => {
      const result = await importClientsCsv(formData);
      setImportMessage(result.message);
      if (result.ok && fileInputRef.current) {
        fileInputRef.current.value = "";
        window.location.reload();
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 font-medium">Name</th>
            <th className="py-2 font-medium">Contact</th>
            <th className="py-2 font-medium">Sites</th>
            <th className="py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((c) =>
            editingId === c.id ? (
              <tr key={c.id} className="border-b">
                <td className="py-2">
                  <input
                    value={editFields.name}
                    onChange={(e) => setEditFields((f) => ({ ...f, name: e.target.value }))}
                    className="border-input h-8 w-full rounded-md border bg-transparent px-2 text-sm"
                  />
                </td>
                <td className="py-2">
                  <div className="flex flex-col gap-1">
                    <input
                      placeholder="Contact name"
                      value={editFields.contact_name}
                      onChange={(e) => setEditFields((f) => ({ ...f, contact_name: e.target.value }))}
                      className="border-input h-8 rounded-md border bg-transparent px-2 text-sm"
                    />
                    <input
                      placeholder="Contact email"
                      value={editFields.contact_email}
                      onChange={(e) => setEditFields((f) => ({ ...f, contact_email: e.target.value }))}
                      className="border-input h-8 rounded-md border bg-transparent px-2 text-sm"
                    />
                    <input
                      placeholder="Contact phone"
                      value={editFields.contact_phone}
                      onChange={(e) => setEditFields((f) => ({ ...f, contact_phone: e.target.value }))}
                      className="border-input h-8 rounded-md border bg-transparent px-2 text-sm"
                    />
                  </div>
                </td>
                <td className="py-2 text-muted-foreground">{siteCounts[c.id] ?? 0}</td>
                <td className="py-2">
                  <div className="flex gap-2">
                    <Button type="button" size="sm" disabled={isPending || !editFields.name.trim()} onClick={() => handleSaveEdit(c.id)}>
                      Save
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={c.id} className="border-b">
                <td className="py-2">
                  <Link href={`/office/clients/${c.id}`} className="font-medium hover:underline">
                    {c.name}
                  </Link>
                </td>
                <td className="py-2 text-muted-foreground">
                  {[c.contact_name, c.contact_email, c.contact_phone].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="py-2 text-muted-foreground">{siteCounts[c.id] ?? 0}</td>
                <td className="py-2">
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => startEdit(c)}>
                      Edit
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => handleDelete(c.id)}>
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ),
          )}
          {clients.length === 0 && (
            <tr>
              <td colSpan={4} className="text-muted-foreground py-4 text-center">
                No clients yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {rowMessage && <p className="text-destructive text-sm">{rowMessage}</p>}

      <section className="flex flex-col gap-3 border-t pt-4">
        <h2 className="font-medium">Add a client</h2>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-muted-foreground text-xs">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-muted-foreground text-xs">Contact name</label>
            <input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-muted-foreground text-xs">Contact email</label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-muted-foreground text-xs">Contact phone</label>
            <input
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
            />
          </div>
          <Button type="button" onClick={handleCreate} disabled={isPending || !name.trim()}>
            Add client
          </Button>
        </div>
        {message && <p className="text-muted-foreground text-sm">{message}</p>}
      </section>

      <section className="flex flex-col gap-3 border-t pt-4">
        <h2 className="font-medium">Or import clients from CSV</h2>
        <p className="text-muted-foreground text-sm">
          Required column: <code>name</code>. Optional: <code>contact_name</code>,{" "}
          <code>contact_email</code>, <code>contact_phone</code>, <code>notes</code>.
        </p>
        <form action={handleImport} className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" name="file" accept=".csv,text/csv" required className="text-sm" />
          <Button type="submit" size="sm" disabled={isImporting}>
            {isImporting ? "Importing…" : "Import"}
          </Button>
        </form>
        {importMessage && <p className="text-sm">{importMessage}</p>}
      </section>
    </div>
  );
}
