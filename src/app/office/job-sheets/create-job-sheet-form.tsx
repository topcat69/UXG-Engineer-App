"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createJobSheet } from "./actions";

export function CreateJobSheetForm({
  projects,
  sites,
}: {
  projects: { id: string; name: string; client_id: string | null }[];
  sites: { id: string; name: string; client_id: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [reference, setReference] = useState("");
  const [proposedInstallDate, setProposedInstallDate] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedProject = projects.find((p) => p.id === projectId);
  const projectSites = useMemo(
    () => (selectedProject?.client_id ? sites.filter((s) => s.client_id === selectedProject.client_id) : []),
    [sites, selectedProject],
  );

  function handleCreate() {
    startTransition(async () => {
      const result = await createJobSheet(projectId, siteId, reference, proposedInstallDate, jobDescription);
      if (result.ok) {
        // router.push to this same URL wouldn't reset any of this form's own
        // state (same route, no remount) — clearing it explicitly is what
        // actually gets a fresh form for the next one, collapsed back to the
        // button rather than left open with the just-created sheet's values
        // still sitting in it.
        setOpen(false);
        setProjectId("");
        setSiteId("");
        setReference("");
        setProposedInstallDate("");
        setJobDescription("");
        setMessage(null);
        router.refresh();
      } else {
        setMessage(result.message);
      }
    });
  }

  if (!open) {
    return (
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        New Job Sheet
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border bg-muted/40 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs">Job ref</label>
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. JS-2026-014"
            className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs">Project</label>
          <select
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              setSiteId("");
            }}
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
          <label className="text-muted-foreground text-xs">Store / site</label>
          <select
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            disabled={!selectedProject?.client_id}
            className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
          >
            <option value="">{selectedProject?.client_id ? "Select…" : "Pick a project first"}</option>
            {projectSites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs">Proposed install date</label>
          <input
            type="date"
            value={proposedInstallDate}
            onChange={(e) => setProposedInstallDate(e.target.value)}
            className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-muted-foreground text-xs">Job description</label>
        <textarea
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          rows={2}
          className="border-input rounded-md border bg-transparent px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={isPending || !projectId || !siteId || !reference.trim()} onClick={handleCreate}>
          {isPending ? "Creating…" : "Create job sheet"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {projectId && !selectedProject?.client_id && (
        <p className="text-muted-foreground text-sm">
          This project has no customer assigned yet — set one on the Projects page first.
        </p>
      )}
      {selectedProject?.client_id && projectSites.length === 0 && (
        <p className="text-muted-foreground text-sm">
          This customer has no sites yet — add one from its Customers page first.
        </p>
      )}
      {message && <p className="text-destructive text-sm">{message}</p>}
    </div>
  );
}
