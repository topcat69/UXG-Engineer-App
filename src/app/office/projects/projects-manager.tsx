"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createProject, type ProjectRow } from "./actions";

const STATUSES = ["active", "on_hold", "completed"];

export function ProjectsManager({
  projects: initialProjects,
  jobCounts,
}: {
  projects: ProjectRow[];
  jobCounts: Record<string, number>;
}) {
  const [projects, setProjects] = useState(initialProjects);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("active");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    startTransition(async () => {
      const result = await createProject({ name, start_date: startDate, end_date: endDate, status });
      if (result.ok) {
        setProjects((prev) => [result.project, ...prev]);
        setName("");
        setStartDate("");
        setEndDate("");
        setStatus("active");
        setMessage(`${result.project.name} added.`);
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
            <th className="py-2 font-medium">Status</th>
            <th className="py-2 font-medium">Dates</th>
            <th className="py-2 font-medium">Jobs</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.id} className="border-b">
              <td className="py-2 font-medium">{p.name}</td>
              <td className="py-2">
                <Badge variant="secondary">{p.status}</Badge>
              </td>
              <td className="py-2 text-muted-foreground">
                {[p.start_date, p.end_date].filter(Boolean).join(" – ") || "—"}
              </td>
              <td className="py-2 text-muted-foreground">{jobCounts[p.id] ?? 0}</td>
            </tr>
          ))}
          {projects.length === 0 && (
            <tr>
              <td colSpan={4} className="text-muted-foreground py-4 text-center">
                No projects yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <section className="flex flex-col gap-3 border-t pt-4">
        <h2 className="font-medium">Add a project</h2>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-muted-foreground text-xs">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jobs 2026"
              className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-muted-foreground text-xs">Start date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-muted-foreground text-xs">End date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-muted-foreground text-xs">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <Button type="button" onClick={handleCreate} disabled={isPending || !name.trim()}>
            Add project
          </Button>
        </div>
        {message && <p className="text-muted-foreground text-sm">{message}</p>}
      </section>
    </div>
  );
}
