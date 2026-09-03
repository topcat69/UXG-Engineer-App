"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { humanize } from "@/lib/format/text";
import { createProject } from "../../projects/actions";

const STATUSES = ["active", "on_hold", "completed"];

type ClientProject = {
  id: string;
  name: string;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
};

/**
 * A project belongs to exactly one client (see 20260204000000_project_client.sql),
 * so it's created here, scoped to this client, rather than on /office/projects
 * with a Client dropdown to pick from — the natural flow is client first, then
 * its projects, same as Sites below. /office/projects stays for browsing and
 * editing (including reassigning a project's client) across all clients at once.
 */
export function ClientProjects({ clientId, projects: initialProjects }: { clientId: string; projects: ClientProject[] }) {
  const [projects, setProjects] = useState(initialProjects);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("active");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    startTransition(async () => {
      const result = await createProject({ name, client_id: clientId, start_date: startDate, end_date: endDate, status });
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
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="font-medium">Projects</h2>
        <p className="text-muted-foreground text-sm">
          This customer&apos;s projects. Edit an existing one&apos;s name, dates, or status from the{" "}
          <Link href="/office/projects" className="underline">
            Projects page
          </Link>
          .
        </p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 font-medium">Name</th>
            <th className="py-2 font-medium">Status</th>
            <th className="py-2 font-medium">Dates</th>
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
              <td className="py-2">
                <Badge variant="secondary">{humanize(p.status ?? "")}</Badge>
              </td>
              <td className="py-2 text-muted-foreground">
                {[p.start_date, p.end_date].filter(Boolean).join(" – ") || "—"}
              </td>
            </tr>
          ))}
          {projects.length === 0 && (
            <tr>
              <td colSpan={3} className="text-muted-foreground py-4 text-center">
                No projects yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <section className="flex flex-col gap-3 border-t pt-4">
        <h3 className="font-medium">Add a project</h3>
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
                  {humanize(s)}
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
