"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { addJobTask, applyTemplateToJob, deleteJobTask, toggleJobTask } from "./actions";

type JobTask = { id: string; label: string; is_done: boolean };
type Template = { id: string; name: string };

/**
 * Tasks are held in local state, seeded from server props and patched
 * directly from each action's own return value rather than re-derived from
 * router.refresh() — this build's RSC refresh has proven to lag one
 * mutation behind under rapid sequential edits (see DECISIONS.md).
 */
export function TaskPanel({
  jobId,
  tasks: initialTasks,
  templates,
}: {
  jobId: string;
  tasks: JobTask[];
  templates: Template[];
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [templateId, setTemplateId] = useState("");
  const [newTaskLabel, setNewTaskLabel] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleApplyTemplate() {
    if (!templateId) return;
    startTransition(async () => {
      const result = await applyTemplateToJob(jobId, templateId);
      if (result.ok) {
        setTasks((prev) => [...prev, ...result.tasks]);
        setMessage(`Added ${result.tasks.length} task(s).`);
        setTemplateId("");
        router.refresh();
      } else {
        setMessage(result.message);
      }
    });
  }

  function handleAddTask() {
    const label = newTaskLabel;
    startTransition(async () => {
      const result = await addJobTask(jobId, label);
      if (result.ok) {
        setTasks((prev) => [...prev, result.task]);
        setNewTaskLabel("");
        router.refresh();
      } else {
        setMessage(result.message);
      }
    });
  }

  function handleDeleteTask(taskId: string) {
    startTransition(async () => {
      const result = await deleteJobTask(taskId, jobId);
      if (result.ok) {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
        router.refresh();
      }
    });
  }

  function handleToggleTask(taskId: string, isDone: boolean) {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, is_done: isDone } : t)));
    startTransition(async () => {
      const result = await toggleJobTask(taskId, jobId, isDone);
      if (result.ok) router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium">Tasks</h2>
      <ul className="flex flex-col gap-2">
        {tasks.length === 0 && <li className="text-muted-foreground text-sm">No tasks for this job yet.</li>}
        {tasks.map((task) => (
          <li key={task.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={task.is_done}
              disabled={isPending}
              onChange={(e) => handleToggleTask(task.id, e.target.checked)}
              className="h-4 w-4"
            />
            <span className={`flex-1 ${task.is_done ? "text-muted-foreground line-through" : ""}`}>{task.label}</span>
            <button
              type="button"
              onClick={() => handleDeleteTask(task.id)}
              disabled={isPending}
              className="text-destructive hover:text-destructive/80"
              aria-label="Remove task"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2 border-t pt-3">
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          aria-label="Apply template"
          className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
        >
          <option value="">Apply a template…</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <Button type="button" size="sm" variant="outline" onClick={handleApplyTemplate} disabled={isPending || !templateId}>
          Apply
        </Button>
      </div>

      <div className="flex gap-2">
        <input
          value={newTaskLabel}
          onChange={(e) => setNewTaskLabel(e.target.value)}
          placeholder="Add an ad-hoc task"
          className="border-input h-9 flex-1 rounded-md border bg-transparent px-2 text-sm"
        />
        <Button type="button" size="sm" onClick={handleAddTask} disabled={isPending || !newTaskLabel.trim()}>
          Add
        </Button>
      </div>

      {message && <p className="text-muted-foreground text-sm">{message}</p>}
    </section>
  );
}
