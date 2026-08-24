"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/offline/db";
import { humanize } from "@/lib/format/text";
import { isInEngineerQueue } from "@/lib/jobs/engineer-queue";

export function JobList({
  currentUserId,
  onOpenJob,
}: {
  currentUserId: string;
  onOpenJob: (jobId: string) => void;
}) {
  const jobs = useLiveQuery(
    async () => {
      const rows = await db.jobs.where("assigned_to").equals(currentUserId).sortBy("scheduled_start");
      return rows.filter((job) => isInEngineerQueue(job.status));
    },
    [currentUserId],
    undefined,
  );
  const sites = useLiveQuery(() => db.sites.toArray(), [], []);
  const siteById = new Map((sites ?? []).map((s) => [s.id, s]));
  const clients = useLiveQuery(() => db.clients.toArray(), [], []);
  const clientById = new Map((clients ?? []).map((c) => [c.id, c]));

  if (jobs === undefined) {
    return <p className="text-muted-foreground p-4 text-sm">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <h1 className="text-lg font-semibold">My Jobs</h1>
      {jobs.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No jobs assigned in this window. Pull down or reopen the app once online to sync.
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {jobs.map((job) => {
          const site = siteById.get(job.site_id);
          const client = site ? clientById.get(site.client_id) : undefined;
          return (
            <li key={job.id}>
              <button
                type="button"
                onClick={() => onOpenJob(job.id)}
                className="w-full rounded-md border p-3 text-left"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{job.job_number}</span>
                  <Badge variant="secondary">{humanize(job.status)}</Badge>
                </div>
                <p className="text-muted-foreground text-sm">
                  {client ? `${client.name} — ${site?.name ?? "Unknown site"}` : (site?.name ?? "Unknown site")}
                </p>
                <p className="text-muted-foreground text-sm">
                  {job.scheduled_start ? new Date(job.scheduled_start).toLocaleString() : "Not scheduled"}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
