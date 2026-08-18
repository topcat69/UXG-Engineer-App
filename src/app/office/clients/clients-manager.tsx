"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createClientRecord, importClientsCsv, type ClientRow } from "./actions";

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
          </tr>
        </thead>
        <tbody>
          {clients.map((c) => (
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
            </tr>
          ))}
          {clients.length === 0 && (
            <tr>
              <td colSpan={3} className="text-muted-foreground py-4 text-center">
                No clients yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

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
