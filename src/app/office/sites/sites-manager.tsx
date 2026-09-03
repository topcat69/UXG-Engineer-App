"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createSite, deleteSite, updateSite, type SiteRow } from "./actions";

type EditFields = { name: string; client_id: string; address_line1: string; town: string; postcode: string };

function toEditFields(s: SiteRow): EditFields {
  return {
    name: s.name,
    client_id: s.client_id,
    address_line1: s.address_line1 ?? "",
    town: s.town ?? "",
    postcode: s.postcode ?? "",
  };
}

export function SitesManager({
  sites: initialSites,
  jobCounts,
  clients,
}: {
  sites: SiteRow[];
  jobCounts: Record<string, number>;
  clients: { id: string; name: string }[];
}) {
  const [sites, setSites] = useState(initialSites);
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [town, setTown] = useState("");
  const [postcode, setPostcode] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<EditFields>({
    name: "",
    client_id: "",
    address_line1: "",
    town: "",
    postcode: "",
  });
  const [rowMessage, setRowMessage] = useState<string | null>(null);

  function clientName(id: string) {
    return clients.find((c) => c.id === id)?.name ?? "—";
  }

  function handleCreate() {
    startTransition(async () => {
      const result = await createSite({
        client_id: clientId,
        name,
        address_line1: addressLine1,
        town,
        postcode,
      });
      if (result.ok) {
        setSites((prev) => [...prev, result.site].sort((a, b) => a.name.localeCompare(b.name)));
        setName("");
        setClientId("");
        setAddressLine1("");
        setTown("");
        setPostcode("");
        setMessage(`${result.site.name} added.`);
      } else {
        setMessage(result.message);
      }
    });
  }

  function startEdit(s: SiteRow) {
    setEditingId(s.id);
    setEditFields(toEditFields(s));
    setRowMessage(null);
  }

  function handleSaveEdit(siteId: string) {
    startTransition(async () => {
      const result = await updateSite(siteId, editFields);
      if (result.ok) {
        setSites((prev) => prev.map((s) => (s.id === siteId ? result.site : s)).sort((a, b) => a.name.localeCompare(b.name)));
        setEditingId(null);
      } else {
        setRowMessage(result.message);
      }
    });
  }

  function handleDelete(siteId: string) {
    if (!window.confirm("Delete this site? This can't be undone.")) return;
    startTransition(async () => {
      const result = await deleteSite(siteId);
      if (result.ok) {
        setSites((prev) => prev.filter((s) => s.id !== siteId));
      } else {
        setRowMessage(result.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 font-medium">Name</th>
            <th className="py-2 font-medium">Customer</th>
            <th className="py-2 font-medium">Address</th>
            <th className="py-2 font-medium">Jobs</th>
            <th className="py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sites.map((s) =>
            editingId === s.id ? (
              <tr key={s.id} className="border-b">
                <td className="py-2">
                  <input
                    value={editFields.name}
                    onChange={(e) => setEditFields((f) => ({ ...f, name: e.target.value }))}
                    className="border-input h-8 w-full rounded-md border bg-transparent px-2 text-sm"
                  />
                </td>
                <td className="py-2">
                  <select
                    value={editFields.client_id}
                    onChange={(e) => setEditFields((f) => ({ ...f, client_id: e.target.value }))}
                    className="border-input h-8 rounded-md border bg-transparent px-2 text-sm"
                  >
                    <option value="">Select…</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2">
                  <div className="flex flex-col gap-1">
                    <input
                      placeholder="Address"
                      value={editFields.address_line1}
                      onChange={(e) => setEditFields((f) => ({ ...f, address_line1: e.target.value }))}
                      className="border-input h-8 rounded-md border bg-transparent px-2 text-sm"
                    />
                    <div className="flex gap-1">
                      <input
                        placeholder="Town"
                        value={editFields.town}
                        onChange={(e) => setEditFields((f) => ({ ...f, town: e.target.value }))}
                        className="border-input h-8 w-1/2 rounded-md border bg-transparent px-2 text-sm"
                      />
                      <input
                        placeholder="Postcode"
                        value={editFields.postcode}
                        onChange={(e) => setEditFields((f) => ({ ...f, postcode: e.target.value }))}
                        className="border-input h-8 w-1/2 rounded-md border bg-transparent px-2 text-sm"
                      />
                    </div>
                  </div>
                </td>
                <td className="py-2 text-muted-foreground">{jobCounts[s.id] ?? 0}</td>
                <td className="py-2">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={isPending || !editFields.name.trim() || !editFields.client_id}
                      onClick={() => handleSaveEdit(s.id)}
                    >
                      Save
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={s.id} className="border-b">
                <td className="py-2">{s.name}</td>
                <td className="py-2 text-muted-foreground">
                  <Link href={`/office/clients/${s.client_id}`} className="hover:underline">
                    {clientName(s.client_id)}
                  </Link>
                </td>
                <td className="py-2 text-muted-foreground">
                  {[s.address_line1, s.town, s.postcode].filter(Boolean).join(", ") || "—"}
                </td>
                <td className="py-2 text-muted-foreground">{jobCounts[s.id] ?? 0}</td>
                <td className="py-2">
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => startEdit(s)}>
                      Edit
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => handleDelete(s.id)}>
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ),
          )}
          {sites.length === 0 && (
            <tr>
              <td colSpan={5} className="text-muted-foreground py-4 text-center">
                No sites yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {rowMessage && <p className="text-destructive text-sm">{rowMessage}</p>}

      <section className="flex flex-col gap-3 border-t pt-4">
        <h3 className="font-medium">Add a site</h3>
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
            <label className="text-muted-foreground text-xs">Customer</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
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
            <label className="text-muted-foreground text-xs">Address</label>
            <input
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-muted-foreground text-xs">Town</label>
            <input
              value={town}
              onChange={(e) => setTown(e.target.value)}
              className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-muted-foreground text-xs">Postcode</label>
            <input
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
              className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
            />
          </div>
          <Button type="button" onClick={handleCreate} disabled={isPending || !name.trim() || !clientId}>
            Add site
          </Button>
        </div>
        {message && <p className="text-muted-foreground text-sm">{message}</p>}
      </section>
    </div>
  );
}
