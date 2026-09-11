"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createSlaJob } from "./actions";

export function CreateSlaForm({
  clients,
  sites,
  fixtureTypes,
  jobSheets,
}: {
  clients: { id: string; name: string }[];
  sites: { id: string; name: string; client_id: string }[];
  fixtureTypes: { id: string; name: string; client_id: string }[];
  jobSheets: { id: string; reference: string; site_id: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [fixtureTypeId, setFixtureTypeId] = useState("");
  const [jobSheetId, setJobSheetId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const clientSites = useMemo(() => sites.filter((s) => s.client_id === clientId), [sites, clientId]);
  const clientFixtureTypes = useMemo(() => fixtureTypes.filter((f) => f.client_id === clientId), [fixtureTypes, clientId]);
  // Same reasoning as the New Job form: only sheets already prepared for
  // the chosen site are ever the right one to link.
  const siteJobSheets = useMemo(() => (siteId ? jobSheets.filter((js) => js.site_id === siteId) : []), [jobSheets, siteId]);

  function handleCreate() {
    startTransition(async () => {
      const result = await createSlaJob(clientId, siteId, fixtureTypeId, jobSheetId);
      if (result.ok) {
        router.push(`/office/jobs/${result.jobId}`);
      } else {
        setMessage(result.message);
      }
    });
  }

  if (!open) {
    return (
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        New SLA
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border bg-muted/40 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs">Customer</label>
          <select
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setSiteId("");
              setFixtureTypeId("");
            }}
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
          <label className="text-muted-foreground text-xs">Site</label>
          <select
            value={siteId}
            onChange={(e) => {
              setSiteId(e.target.value);
              setJobSheetId("");
            }}
            disabled={!clientId}
            className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
          >
            <option value="">{clientId ? "Select…" : "Pick a customer first"}</option>
            {clientSites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs">Job sheet (optional)</label>
          <select
            value={jobSheetId}
            onChange={(e) => setJobSheetId(e.target.value)}
            disabled={!siteId}
            className="border-input h-9 w-56 rounded-md border bg-transparent px-2 text-sm"
          >
            <option value="">{siteId ? "None" : "Pick a site first"}</option>
            {siteJobSheets.map((js) => (
              <option key={js.id} value={js.id}>
                {js.reference}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs">Fixture type</label>
          <select
            value={fixtureTypeId}
            onChange={(e) => setFixtureTypeId(e.target.value)}
            disabled={!clientId}
            className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
          >
            <option value="">{clientId ? "Select…" : "Pick a customer first"}</option>
            {clientFixtureTypes.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="button" size="sm" disabled={isPending || !clientId || !siteId || !fixtureTypeId} onClick={handleCreate}>
          {isPending ? "Creating…" : "Create SLA"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {clientId && clientSites.length === 0 && (
        <p className="text-muted-foreground text-sm">This customer has no sites yet — add one from its Customers page first.</p>
      )}
      {clientId && clientFixtureTypes.length === 0 && (
        <p className="text-muted-foreground text-sm">
          This customer has no fixture types yet — add some from its Customers page first.
        </p>
      )}
      {message && <p className="text-destructive text-sm">{message}</p>}
    </div>
  );
}
