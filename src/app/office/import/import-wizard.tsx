"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { JOB_TYPES, JOB_TYPE_LABELS } from "@/lib/forms/job-form";
import { generateJobs, importSitesCsv } from "./actions";

export function ImportWizard({
  projects,
  clients,
  allSiteIds,
}: {
  projects: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  allSiteIds: string[];
}) {
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importedSiteIds, setImportedSiteIds] = useState<string[]>([]);
  const [isImporting, startImport] = useTransition();
  const [importClientId, setImportClientId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [target, setTarget] = useState<"imported" | "all">("imported");
  const [projectId, setProjectId] = useState("");
  const [jobType, setJobType] = useState("");
  const [generateMessage, setGenerateMessage] = useState<string | null>(null);
  const [isGenerating, startGenerate] = useTransition();
  const router = useRouter();

  function handleImport(formData: FormData) {
    startImport(async () => {
      const result = await importSitesCsv(formData);
      setImportMessage(result.message);
      if (result.ok) {
        setImportedSiteIds(result.siteIds);
        setTarget("imported");
        if (fileInputRef.current) fileInputRef.current.value = "";
        router.refresh();
      }
    });
  }

  const targetIds = target === "imported" ? importedSiteIds : allSiteIds;

  function handleGenerate() {
    startGenerate(async () => {
      const result = await generateJobs(targetIds, projectId, jobType);
      setGenerateMessage(result.message);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="font-medium">1. Import sites from CSV</h2>
        <p className="text-muted-foreground text-sm">
          Required column: <code>name</code>. Optional: <code>address_line1</code>,{" "}
          <code>address_line2</code>, <code>town</code>, <code>postcode</code>, <code>latitude</code>,{" "}
          <code>longitude</code>, <code>access_notes</code>, <code>contact_name</code>,{" "}
          <code>contact_phone</code>, <code>contact_email</code>. A whole file is imported as one
          customer&apos;s sites — pick which customer below.
        </p>
        <form action={handleImport} className="flex flex-wrap items-center gap-2">
          <select
            name="clientId"
            value={importClientId}
            onChange={(e) => setImportClientId(e.target.value)}
            required
            className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
          >
            <option value="">Customer…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            ref={fileInputRef}
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="text-sm"
          />
          <Button type="submit" size="sm" disabled={isImporting || !importClientId}>
            {isImporting ? "Importing…" : "Import"}
          </Button>
        </form>
        {importMessage && <p className="text-sm">{importMessage}</p>}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">2. Generate jobs</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="target" className="text-xs text-muted-foreground">
              Sites
            </label>
            <select
              id="target"
              value={target}
              onChange={(e) => setTarget(e.target.value as "imported" | "all")}
              className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
            >
              <option value="imported">Just imported ({importedSiteIds.length})</option>
              <option value="all">All sites ({allSiteIds.length})</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="projectId" className="text-xs text-muted-foreground">
              Project
            </label>
            <select
              id="projectId"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
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
            <label htmlFor="jobType" className="text-xs text-muted-foreground">
              Job type
            </label>
            <select
              id="jobType"
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
            size="sm"
            disabled={isGenerating || targetIds.length === 0 || !projectId || !jobType}
            onClick={handleGenerate}
          >
            {isGenerating ? "Generating…" : `Generate ${targetIds.length} job(s)`}
          </Button>
        </div>
        {generateMessage && <p className="text-sm">{generateMessage}</p>}
      </section>
    </div>
  );
}
