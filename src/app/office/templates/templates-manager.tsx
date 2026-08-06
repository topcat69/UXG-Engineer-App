"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  addTemplateTask,
  createTemplate,
  deleteTemplate,
  deleteTemplateTask,
  renameTemplate,
  reorderTemplateTasks,
} from "./actions";

type Template = { id: string; name: string };
type TemplateTask = { id: string; template_id: string; position: number; label: string };

/**
 * Templates and tasks are held in local state, seeded from the server props
 * and then patched directly from each action's own return value — not
 * re-derived from router.refresh(). This build's RSC refresh has proven to
 * lag one mutation behind under rapid sequential edits (see DECISIONS.md),
 * so local state is the source of truth for what's on screen; router.refresh()
 * is still called for the benefit of other tabs/back-forward navigation.
 */
export function TemplatesManager({
  templates: initialTemplates,
  tasks: initialTasks,
}: {
  templates: Template[];
  tasks: TemplateTask[];
}) {
  const router = useRouter();
  const [templates, setTemplates] = useState(initialTemplates);
  const [tasks, setTasks] = useState(initialTasks);
  const [selectedId, setSelectedId] = useState<string | null>(initialTemplates[0]?.id ?? null);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTaskLabel, setNewTaskLabel] = useState("");
  const [renamingName, setRenamingName] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selected = templates.find((t) => t.id === selectedId) ?? null;
  const selectedTasks = tasks.filter((t) => t.template_id === selectedId).sort((a, b) => a.position - b.position);

  function handleCreateTemplate() {
    const name = newTemplateName;
    startTransition(async () => {
      const result = await createTemplate(name);
      if (result.ok) {
        setTemplates((prev) => [...prev, { id: result.templateId, name }].sort((a, b) => a.name.localeCompare(b.name)));
        setSelectedId(result.templateId);
        setNewTemplateName("");
        router.refresh();
      } else {
        setMessage(result.message);
      }
    });
  }

  function handleRenameTemplate() {
    if (!selected || renamingName === null) return;
    const name = renamingName;
    startTransition(async () => {
      const result = await renameTemplate(selected.id, name);
      setMessage(result.message);
      if (result.ok) {
        setTemplates((prev) => prev.map((t) => (t.id === selected.id ? { ...t, name } : t)));
        setRenamingName(null);
        router.refresh();
      }
    });
  }

  function handleDeleteTemplate(id: string) {
    startTransition(async () => {
      const result = await deleteTemplate(id);
      setMessage(result.message);
      if (result.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
        setTasks((prev) => prev.filter((t) => t.template_id !== id));
        if (selectedId === id) setSelectedId(null);
        router.refresh();
      }
    });
  }

  function handleAddTask() {
    if (!selected) return;
    const label = newTaskLabel;
    startTransition(async () => {
      const result = await addTemplateTask(selected.id, label);
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
      const result = await deleteTemplateTask(taskId);
      setMessage(result.message);
      if (result.ok) {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
        router.refresh();
      }
    });
  }

  function handleMoveTask(taskId: string, direction: -1 | 1) {
    const index = selectedTasks.findIndex((t) => t.id === taskId);
    const swapWith = index + direction;
    if (index < 0 || swapWith < 0 || swapWith >= selectedTasks.length) return;

    const reordered = selectedTasks.map((t) => t.id);
    [reordered[index], reordered[swapWith]] = [reordered[swapWith], reordered[index]];
    const positionById = new Map(reordered.map((id, position) => [id, position]));
    setTasks((prev) => prev.map((t) => (positionById.has(t.id) ? { ...t, position: positionById.get(t.id)! } : t)));

    startTransition(async () => {
      const result = await reorderTemplateTasks(reordered);
      if (!result.ok) setMessage(result.message);
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-[minmax(200px,280px)_1fr] gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Templates</h2>
        <ul className="flex flex-col gap-1">
          {templates.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setSelectedId(t.id)}
                className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${
                  t.id === selectedId ? "bg-secondary font-medium" : "hover:bg-secondary/50"
                }`}
              >
                {t.name}
              </button>
            </li>
          ))}
          {templates.length === 0 && <li className="text-muted-foreground text-sm">No templates yet.</li>}
        </ul>

        <div className="flex gap-2 border-t pt-3">
          <input
            value={newTemplateName}
            onChange={(e) => setNewTemplateName(e.target.value)}
            placeholder="New template name"
            className="border-input h-9 flex-1 rounded-md border bg-transparent px-2 text-sm"
          />
          <Button type="button" size="sm" onClick={handleCreateTemplate} disabled={isPending || !newTemplateName.trim()}>
            Add
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        {!selected && <p className="text-muted-foreground text-sm">Select or create a template to edit its tasks.</p>}

        {selected && (
          <>
            <div className="flex items-center justify-between gap-2">
              {renamingName === null ? (
                <button
                  type="button"
                  onClick={() => setRenamingName(selected.name)}
                  className="font-medium hover:underline"
                  title="Click to rename"
                >
                  {selected.name}
                </button>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={renamingName}
                    onChange={(e) => setRenamingName(e.target.value)}
                    autoFocus
                    className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
                  />
                  <Button type="button" size="sm" onClick={handleRenameTemplate} disabled={isPending || !renamingName.trim()}>
                    Save
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setRenamingName(null)}>
                    Cancel
                  </Button>
                </div>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  if (confirm(`Delete template "${selected.name}"? This does not affect jobs it was already applied to.`)) {
                    handleDeleteTemplate(selected.id);
                  }
                }}
                disabled={isPending}
              >
                Delete template
              </Button>
            </div>

            <ol className="flex flex-col gap-1">
              {selectedTasks.map((task, index) => (
                <li key={task.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <span className="flex-1">{task.label}</span>
                  <button
                    type="button"
                    onClick={() => handleMoveTask(task.id, -1)}
                    disabled={isPending || index === 0}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    aria-label="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveTask(task.id, 1)}
                    disabled={isPending || index === selectedTasks.length - 1}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    aria-label="Move down"
                  >
                    ↓
                  </button>
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
              {selectedTasks.length === 0 && <li className="text-muted-foreground text-sm">No tasks yet.</li>}
            </ol>

            <div className="flex gap-2 border-t pt-3">
              <input
                value={newTaskLabel}
                onChange={(e) => setNewTaskLabel(e.target.value)}
                placeholder="New task, e.g. 'Test power cycle'"
                className="border-input h-9 flex-1 rounded-md border bg-transparent px-2 text-sm"
              />
              <Button type="button" size="sm" onClick={handleAddTask} disabled={isPending || !newTaskLabel.trim()}>
                Add task
              </Button>
            </div>
          </>
        )}

        {message && <p className="text-muted-foreground text-sm">{message}</p>}
      </section>
    </div>
  );
}
