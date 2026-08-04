"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { rescheduleJob } from "./actions";

type JobRow = {
  id: string;
  job_number: string;
  status: string;
  assigned_to: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  site: { name: string } | null;
};

type Engineer = { id: string; name: string; max_jobs_per_day: number | null; icsUrl: string };

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function SchedulerBoard({
  days,
  engineers,
  jobs,
}: {
  days: string[];
  engineers: Engineer[];
  jobs: JobRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  const lanes: { key: string; label: string; engineerId: string | null; icsUrl?: string }[] = [
    { key: "unassigned", label: "Unassigned", engineerId: null },
    ...engineers.map((e) => ({ key: e.id, label: e.name, engineerId: e.id, icsUrl: e.icsUrl })),
  ];

  function jobsFor(laneKey: string, day: string): JobRow[] {
    return jobs.filter((j) => {
      if (!j.scheduled_start) return false;
      const jobLaneKey = j.assigned_to ?? "unassigned";
      return jobLaneKey === laneKey && j.scheduled_start.slice(0, 10) === day;
    });
  }

  function handleDrop(day: string, engineerId: string | null) {
    return (e: React.DragEvent) => {
      e.preventDefault();
      setDragOverKey(null);
      const jobId = e.dataTransfer.getData("text/plain");
      if (!jobId) return;
      startTransition(async () => {
        const result = await rescheduleJob(jobId, day, engineerId);
        setMessage(result.message);
        router.refresh();
      });
    };
  }

  return (
    <div className="flex flex-col gap-2">
      {message && <p className="text-muted-foreground text-sm">{message}</p>}
      <div className="overflow-x-auto">
        <div className="grid min-w-[900px] grid-cols-[140px_repeat(7,1fr)] gap-1">
          <div />
          {days.map((day, i) => (
            <div key={day} className="text-center text-xs font-medium text-muted-foreground">
              {DAY_LABELS[i]} {new Date(day).getDate()}
            </div>
          ))}

          {lanes.map((lane) => (
            <FragmentRow
              key={lane.key}
              lane={lane}
              days={days}
              jobsFor={jobsFor}
              dragOverKey={dragOverKey}
              setDragOverKey={setDragOverKey}
              handleDrop={handleDrop}
              isPending={isPending}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FragmentRow({
  lane,
  days,
  jobsFor,
  dragOverKey,
  setDragOverKey,
  handleDrop,
  isPending,
}: {
  lane: { key: string; label: string; engineerId: string | null; icsUrl?: string };
  days: string[];
  jobsFor: (laneKey: string, day: string) => JobRow[];
  dragOverKey: string | null;
  setDragOverKey: React.Dispatch<React.SetStateAction<string | null>>;
  handleDrop: (day: string, engineerId: string | null) => (e: React.DragEvent) => void;
  isPending: boolean;
}) {
  return (
    <>
      <div className="flex flex-col justify-center text-sm font-medium">
        <span>{lane.label}</span>
        {lane.icsUrl && (
          <a
            href={lane.icsUrl}
            className="text-muted-foreground text-[10px] font-normal underline"
            title="Subscribe in any calendar app"
          >
            📅 ICS feed
          </a>
        )}
      </div>
      {days.map((day) => {
        const cellKey = `${lane.key}:${day}`;
        const cellJobs = jobsFor(lane.key, day);
        return (
          <div
            key={cellKey}
            data-testid="scheduler-cell"
            data-lane={lane.key}
            data-day={day}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverKey(cellKey);
            }}
            onDragLeave={() => setDragOverKey((prev) => (prev === cellKey ? null : prev))}
            onDrop={handleDrop(day, lane.engineerId)}
            className={`flex min-h-16 flex-col gap-1 rounded-md border p-1 transition-colors ${
              dragOverKey === cellKey ? "bg-accent border-primary" : ""
            } ${isPending ? "opacity-60" : ""}`}
          >
            {cellJobs.map((job) => (
              <div
                key={job.id}
                draggable
                data-testid="scheduler-card"
                data-job-id={job.id}
                onDragStart={(e) => e.dataTransfer.setData("text/plain", job.id)}
                className="cursor-grab rounded border bg-card p-1 text-xs shadow-sm active:cursor-grabbing"
                title={`${job.job_number} · ${job.site?.name ?? ""}`}
              >
                <div className="font-medium">{job.job_number}</div>
                <div className="text-muted-foreground truncate">{job.site?.name}</div>
                <Badge variant="secondary" className="mt-0.5 text-[10px]">
                  {job.status}
                </Badge>
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}
