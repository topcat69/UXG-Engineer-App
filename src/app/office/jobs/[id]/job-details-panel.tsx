"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { showsSiteplanAndEquipment, showsSlaRequirement, usesJobDetails, type JobDetailsType } from "@/lib/forms/job-form";
import { addJobEquipment, deleteJobEquipment, updateSlaRequirement, uploadJobDocument, type JobEquipmentRow } from "./actions";

type JobDetailsData = { rams_storage_path: string | null; site_plan_storage_path: string | null; sla_requirement_detail: string | null } | null;

/**
 * Office-side "Info on system" prep: RAMS/site plan uploads, the SLA
 * requirement note, and the equipment list — reference material the field
 * app shows read-only to the engineer (see job-workflow.tsx's
 * JobDetailsSection). Returns null for job types that don't use job_details
 * (survey) rather than the caller needing to guard every render site.
 */
export function JobDetailsPanel({
  jobId,
  jobType,
  jobDetails,
  equipment: initialEquipment,
}: {
  jobId: string;
  jobType: JobDetailsType | string;
  jobDetails: JobDetailsData;
  equipment: JobEquipmentRow[];
}) {
  const [equipment, setEquipment] = useState(initialEquipment);
  const [model, setModel] = useState("");
  const [serial, setSerial] = useState("");
  const [slaDetail, setSlaDetail] = useState(jobDetails?.sla_requirement_detail ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const ramsInputRef = useRef<HTMLInputElement>(null);
  const sitePlanInputRef = useRef<HTMLInputElement>(null);

  if (!usesJobDetails(jobType)) return null;
  const type = jobType as JobDetailsType;

  function handleUpload(kind: "rams" | "site_plan", input: HTMLInputElement | null) {
    const file = input?.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      const result = await uploadJobDocument(jobId, kind, formData);
      setMessage(result.message);
      if (input) input.value = "";
    });
  }

  function handleSaveSla() {
    startTransition(async () => {
      const result = await updateSlaRequirement(jobId, slaDetail);
      setMessage(result.message);
    });
  }

  function handleAddEquipment() {
    startTransition(async () => {
      const result = await addJobEquipment(jobId, model, serial);
      if (result.ok) {
        setEquipment((prev) => [...prev, result.item]);
        setModel("");
        setSerial("");
      } else {
        setMessage(result.message);
      }
    });
  }

  function handleRemoveEquipment(itemId: string) {
    startTransition(async () => {
      const result = await deleteJobEquipment(itemId, jobId);
      if (result.ok) setEquipment((prev) => prev.filter((e) => e.id !== itemId));
      else setMessage(result.message);
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-md border p-3">
      <h2 className="font-medium">Info on system (prepared for the engineer)</h2>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">RAMS</span>
          <div className="flex items-center gap-2">
            <span className="text-sm">{jobDetails?.rams_storage_path ? "Attached" : "Not attached"}</span>
            <input ref={ramsInputRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={() => handleUpload("rams", ramsInputRef.current)} />
            <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => ramsInputRef.current?.click()}>
              Upload
            </Button>
          </div>
        </div>

        {showsSiteplanAndEquipment(type) && (
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Site plan</span>
            <div className="flex items-center gap-2">
              <span className="text-sm">{jobDetails?.site_plan_storage_path ? "Attached" : "Not attached"}</span>
              <input ref={sitePlanInputRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={() => handleUpload("site_plan", sitePlanInputRef.current)} />
              <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => sitePlanInputRef.current?.click()}>
                Upload
              </Button>
            </div>
          </div>
        )}
      </div>

      {showsSlaRequirement(type) && (
        <div className="flex flex-col gap-2">
          <span className="text-muted-foreground text-xs">SLA requirement</span>
          <Textarea value={slaDetail} onChange={(e) => setSlaDetail(e.target.value)} rows={3} />
          <Button type="button" size="sm" disabled={isPending} onClick={handleSaveSla} className="self-start">
            Save
          </Button>
        </div>
      )}

      {showsSiteplanAndEquipment(type) && (
        <div className="flex flex-col gap-2">
          <span className="text-muted-foreground text-xs">Equipment list</span>
          {equipment.length > 0 && (
            <ul className="flex flex-col gap-1">
              {equipment.map((item) => (
                <li key={item.id} className="flex items-center gap-2 text-sm">
                  <span>
                    {item.model}
                    {item.serial ? ` — ${item.serial}` : ""}
                  </span>
                  <button type="button" onClick={() => handleRemoveEquipment(item.id)} className="text-destructive text-xs underline" disabled={isPending}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">Model</label>
              <input value={model} onChange={(e) => setModel(e.target.value)} className="border-input h-9 rounded-md border bg-transparent px-2 text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">Serial</label>
              <input value={serial} onChange={(e) => setSerial(e.target.value)} className="border-input h-9 rounded-md border bg-transparent px-2 text-sm" />
            </div>
            <Button type="button" size="sm" disabled={isPending || !model.trim()} onClick={handleAddEquipment}>
              Add
            </Button>
          </div>
        </div>
      )}

      {message && <p className="text-muted-foreground text-sm">{message}</p>}
    </section>
  );
}
