"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createSiteForClient, type SiteRow } from "../actions";

export function ClientSites({ clientId, sites: initialSites }: { clientId: string; sites: SiteRow[] }) {
  const [sites, setSites] = useState(initialSites);
  const [name, setName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [town, setTown] = useState("");
  const [postcode, setPostcode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    startTransition(async () => {
      const result = await createSiteForClient(clientId, {
        name,
        address_line1: addressLine1,
        town,
        postcode,
      });
      if (result.ok) {
        setSites((prev) => [...prev, result.site].sort((a, b) => a.name.localeCompare(b.name)));
        setName("");
        setAddressLine1("");
        setTown("");
        setPostcode("");
        setMessage(`${result.site.name} added.`);
      } else {
        setMessage(result.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-medium">Sites</h2>
        <p className="text-muted-foreground text-sm">
          The individual locations this client&apos;s jobs happen at — e.g. each store. If a client
          has no separate stores, add one site using the client&apos;s own name.
        </p>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 font-medium">Name</th>
            <th className="py-2 font-medium">Address</th>
          </tr>
        </thead>
        <tbody>
          {sites.map((s) => (
            <tr key={s.id} className="border-b">
              <td className="py-2">{s.name}</td>
              <td className="py-2 text-muted-foreground">
                {[s.address_line1, s.town, s.postcode].filter(Boolean).join(", ") || "—"}
              </td>
            </tr>
          ))}
          {sites.length === 0 && (
            <tr>
              <td colSpan={2} className="text-muted-foreground py-4 text-center">
                No sites yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

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
          <Button type="button" onClick={handleCreate} disabled={isPending || !name.trim()}>
            Add site
          </Button>
        </div>
        {message && <p className="text-muted-foreground text-sm">{message}</p>}
      </section>
    </div>
  );
}
