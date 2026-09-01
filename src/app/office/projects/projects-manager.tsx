"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { humanize } from "@/lib/format/text";
import { updateProject, type ProjectRow } from "./actions";

const STATUSES = ["active", "on_hold", "completed"];

export function ProjectsManager({
  projects: initialProjects,
  jobCounts,
  clients,
}: {
  projects: ProjectRow[];
  jobCounts: Record<string, number>;
  clients: { id: string; name: string }[];
}) {
  const [projects, setProjects] = useState(initialProjects);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editClientId, setEditClientId] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editStatus, setEditStatus] = useState("active");

  function clientName(id: string | null) {
    return clients.find((c) => c.id === id)?.name ?? "—";
  }

  function handleStartEdit(p: ProjectRow) {
    setEditingId(p.id);
    setEditName(p.name);
    setEditClientId(p.client_id ?? "");
    setEditStartDate(p.start_date ?? "");
    setEditEndDate(p.end_date ?? "");
    setEditStatus(p.status ?? "active");
    setMessage(null);
  }

  function handleCancelEdit() {
    setEditingId(null);
  }

  function handleSaveEdit() {
    if (!editingId) return;
    const id = editingId;
    startTransition(async () => {
      const result = await updateProject(id, {
        name: editName,
        client_id: editClientId,
        start_date: editStartDate,
        end_date: editEndDate,
        status: editStatus,
      });
      if (result.ok) {
        setProjects((prev) => prev.map((p) => (p.id === id ? result.project : p)));
        setEditingId(null);
      } else {
        setMessage(result.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 font-medium">Name</th>
            <th className="py-2 font-medium">Client</th>
            <th className="py-2 font-medium">Status</th>
            <th className="py-2 font-medium">Dates</th>
            <th className="py-2 font-medium">Jobs</th>
            <th className="py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.id} className="border-b">
              <td className="py-2 font-medium">
                <Link href={`/office/jobs?project_id=${p.id}`} className="hover:underline">
                  {p.name}
                </Link>
              </td>
              <td className="py-2 text-muted-foreground">
                {p.client_id ? (
                  <Link href={`/office/clients/${p.client_id}`} className="hover:underline">
                    {clientName(p.client_id)}
                  </Link>
                ) : (
                  "—"
                )}
              </td>
              <td className="py-2">
                <Badge variant="secondary">{humanize(p.status ?? "")}</Badge>
              </td>
              <td className="py-2 text-muted-foreground">
                {[p.start_date, p.end_date].filter(Boolean).join(" – ") || "—"}
              </td>
              <td className="py-2 text-muted-foreground">
                <Link href={`/office/jobs?project_id=${p.id}`} className="hover:underline">
                  {jobCounts[p.id] ?? 0}
                </Link>
              </td>
              <td className="py-2">
                <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => handleStartEdit(p)}>
                  Edit
                </Button>
              </td>
            </tr>
          ))}
          {projects.length === 0 && (
            <tr>
              <td colSpan={6} className="text-muted-foreground py-4 text-center">
                No projects yet. Add one from a client&apos;s page.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {editingId && (
        <section className="flex flex-col gap-3 rounded-md border p-3">
          <h2 className="font-medium">Edit {projects.find((p) => p.id === editingId)?.name}</h2>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">Name</label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">Client</label>
              <select
                value={editClientId}
                onChange={(e) => setEditClientId(e.target.value)}
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
              <label className="text-muted-foreground text-xs">Start date</label>
              <input
                type="date"
                value={editStartDate}
                onChange={(e) => setEditStartDate(e.target.value)}
                className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">End date</label>
              <input
                type="date"
                value={editEndDate}
                onChange={(e) => setEditEndDate(e.target.value)}
                className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">Status</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {humanize(s)}
                  </option>
                ))}
              </select>
            </div>
            <Button type="button" disabled={isPending || !editName.trim() || !editClientId} onClick={handleSaveEdit}>
              Save
            </Button>
            <Button type="button" variant="outline" disabled={isPending} onClick={handleCancelEdit}>
              Cancel
            </Button>
          </div>
        </section>
      )}
      {message && <p className="text-destructive text-sm">{message}</p>}
    </div>
  );
}
