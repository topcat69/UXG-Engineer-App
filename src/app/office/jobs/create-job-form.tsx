"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { JOB_TYPES, JOB_TYPE_LABELS } from "@/lib/forms/job-form";
import { createJob } from "./actions";

export function CreateJobForm({
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
  const [jobType, setJobType] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedProject = projects.find((p) => p.id === projectId);
  const projectSites = useMemo(
    () => (selectedProject?.client_id ? sites.filter((s) => s.client_id === selectedProject.client_id) : []),
    [sites, selectedProject],
  );

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
          <label className="text-muted-foreground text-xs">Site</label>
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
          <label className="text-muted-foreground text-xs">Job type</label>
          <select
            value={jobType}
            onChange={(e) => setJobType(e.target.value)}
            className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
          >
            <option value="">Select…</option>
            {JOB_TYPES.map((t) => (
              <option key={t} value={t}>
                {JOB_TYPE_LABELS[t]}
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
      {projectId && !selectedProject?.client_id && (
        <p className="text-muted-foreground text-sm">
          This project has no client assigned yet — set one on the Projects page first.
        </p>
      )}
      {selectedProject?.client_id && projectSites.length === 0 && (
        <p className="text-muted-foreground text-sm">
          This client has no sites yet — add one from its Clients page first.
        </p>
      )}
      {message && <p className="text-destructive text-sm">{message}</p>}
    </div>
  );
}
