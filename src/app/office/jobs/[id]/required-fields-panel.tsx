"use client";

import { useState, useTransition } from "react";
import { requirableFieldsFor, usesJobDetails, type JobDetailsType, type RequirableFieldKey } from "@/lib/forms/job-form";
import { setJobFieldRequired } from "./actions";

/**
 * Lets a manager mark individual job_details form fields optional for one
 * specific job — everything defaults to required (see job_optional_fields'
 * own comment for why that's true with zero rows, not something seeded
 * here). This is deliberately scoped to form fields only: photos, the
 * signature, and the task checklist all have their own separate
 * "what's required" story and aren't touched by this panel.
 */
export function RequiredFieldsPanel({
  jobId,
  jobType,
  optionalKeys: initialOptionalKeys,
}: {
  jobId: string;
  jobType: JobDetailsType | string;
  optionalKeys: RequirableFieldKey[];
}) {
  const [optionalKeys, setOptionalKeys] = useState(new Set<RequirableFieldKey>(initialOptionalKeys));
  const [isPending, startTransition] = useTransition();

  if (!usesJobDetails(jobType)) return null;
  const fields = requirableFieldsFor(jobType);
  if (fields.length === 0) return null;

  function handleToggle(key: RequirableFieldKey, required: boolean) {
    setOptionalKeys((prev) => {
      const next = new Set(prev);
      if (required) next.delete(key);
      else next.add(key);
      return next;
    });
    startTransition(async () => {
      const result = await setJobFieldRequired(jobId, key, required);
      if (!result.ok) {
        // Revert on failure so the checkbox doesn't lie about what's saved.
        setOptionalKeys((prev) => {
          const next = new Set(prev);
          if (required) next.add(key);
          else next.delete(key);
          return next;
        });
      }
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-md border p-3">
      <div>
        <h2 className="font-medium">Required fields</h2>
        <p className="text-muted-foreground text-xs">
          Everything is required by default — untick anything this job genuinely doesn&apos;t need.
        </p>
      </div>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
        {fields.map((field) => (
          <li key={field.key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              id={`required-${field.key}`}
              checked={!optionalKeys.has(field.key)}
              disabled={isPending}
              onChange={(e) => handleToggle(field.key, e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor={`required-${field.key}`}>{field.label}</label>
          </li>
        ))}
      </ul>
    </section>
  );
}
