"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createJob } from "./actions";

const JOB_TYPES = ["install", "survey"];

export function CreateJobForm({
  projects,
  clients,
  sites,
}: {
  projects: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  sites: { id: string; name: string; client_id: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [clientId, setClientId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [jobType, setJobType] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const clientSites = useMemo(() => sites.filter((s) => s.client_id === clientId), [sites, clientId]);

  function handleCreate() {
    startTransition(async () => {
      const result = await createJob(projectId, siteId, jobType);
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
        New Job
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border bg-muted/40 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs">Project</label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
          >
            <option value="">Select…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs">Client</label>
          <select
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setSiteId("");
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
            onChange={(e) => setSiteId(e.target.value)}
            disabled={!clientId}
            className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
          >
            <option value="">{clientId ? "Select…" : "Pick a client first"}</option>
            {clientSites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs">Job type</label>
          <select
            value={jobType}
            onChange={(e) => setJobType(e.target.value)}
            className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
          >
            <option value="">Select…</option>
            {JOB_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={isPending || !projectId || !siteId || !jobType}
          onClick={handleCreate}
        >
          {isPending ? "Creating…" : "Create job"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {clientId && clientSites.length === 0 && (
        <p className="text-muted-foreground text-sm">
          This client has no sites yet — add one from its Clients page first.
        </p>
      )}
      {message && <p className="text-destructive text-sm">{message}</p>}
    </div>
  );
}
