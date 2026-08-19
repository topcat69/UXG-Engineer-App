"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { humanize } from "@/lib/format/text";
import { JOB_TYPES, JOB_TYPE_LABELS } from "@/lib/forms/job-form";
import { updateJob } from "./actions";

const PRIORITIES = ["P1", "P2", "P3", "P4"];

/**
 * Toggle-to-edit inline form for the job's core static fields — same
 * fields createJob collects (project, client/site, job type), plus
 * priority and description, which createJob never set at all. View mode
 * renders identically to the existing job_type/priority/project/client
 * line so the page layout doesn't shift; edit mode swaps it for the form.
 */
export function EditJobPanel({
  jobId,
  projectId,
  projectName,
  clientId,
  clientName,
  siteId,
  siteName,
  jobType,
  priority,
  description,
  projects,
  clients,
  sites,
}: {
  jobId: string;
  projectId: string | null;
  projectName: string | null;
  clientId: string | null;
  clientName: string | null;
  siteId: string;
  siteName: string;
  jobType: string;
  priority: string | null;
  description: string | null;
  projects: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  sites: { id: string; name: string; client_id: string }[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [editProjectId, setEditProjectId] = useState(projectId ?? "");
  const [editClientId, setEditClientId] = useState(clientId ?? "");
  const [editSiteId, setEditSiteId] = useState(siteId);
  const [editJobType, setEditJobType] = useState(jobType);
  const [editPriority, setEditPriority] = useState(priority ?? "P3");
  const [editDescription, setEditDescription] = useState(description ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const clientSites = useMemo(() => sites.filter((s) => s.client_id === editClientId), [sites, editClientId]);

  function handleSave() {
    startTransition(async () => {
      const result = await updateJob(jobId, {
        project_id: editProjectId,
        site_id: editSiteId,
        job_type: editJobType,
        priority: editPriority,
        description: editDescription,
      });
      if (result.ok) {
        setEditing(false);
        router.refresh();
      } else {
        setMessage(result.message);
      }
    });
  }

  if (!editing) {
    return (
      <p className="text-muted-foreground text-sm">
        {JOB_TYPE_LABELS[jobType as keyof typeof JOB_TYPE_LABELS] ?? humanize(jobType)} · Priority {priority ?? "P3"}{" "}
        ·{" "}
        <Link href={`/office/jobs?project_id=${projectId ?? ""}`} className="underline">
          {projectName ?? "No project"}
        </Link>
        {clientId && clientName && (
          <>
            {" "}
            ·{" "}
            <Link href={`/office/clients/${clientId}`} className="underline">
              {clientName}
            </Link>
          </>
        )}{" "}
        <button type="button" onClick={() => setEditing(true)} className="text-xs underline">
          Edit
        </button>
        {description && <span className="mt-1 block">{description}</span>}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border bg-muted/40 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs">Project</label>
          <select
            value={editProjectId}
            onChange={(e) => setEditProjectId(e.target.value)}
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
            value={editClientId}
            onChange={(e) => {
              setEditClientId(e.target.value);
              setEditSiteId("");
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
            value={editSiteId}
            onChange={(e) => setEditSiteId(e.target.value)}
            disabled={!editClientId}
            className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
          >
            <option value="">{editClientId ? "Select…" : "Pick a client first"}</option>
            {clientSites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            {!clientSites.some((s) => s.id === editSiteId) && editSiteId && (
              <option value={editSiteId}>{siteName}</option>
            )}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs">Job type</label>
          <select
            value={editJobType}
            onChange={(e) => setEditJobType(e.target.value)}
            className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
          >
            {JOB_TYPES.map((t) => (
              <option key={t} value={t}>
                {JOB_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs">Priority</label>
          <select
            value={editPriority}
            onChange={(e) => setEditPriority(e.target.value)}
            className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-muted-foreground text-xs">Description</label>
        <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2} />
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={isPending || !editProjectId || !editSiteId || !editJobType}
          onClick={handleSave}
        >
          {isPending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
      {message && <p className="text-destructive text-sm">{message}</p>}
    </div>
  );
}
