"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTestResultWifiDongle } from "./actions";

const OPTIONS = [
  { value: "", label: "—" },
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "na", label: "N/A" },
];

/** Same save-on-change pattern as TestResultFlagControl, just a 3-way choice instead of a checkbox. */
export function TestResultWifiDongleControl({
  testId,
  jobSheetId,
  value,
}: {
  testId: string;
  jobSheetId: string;
  value: string | null;
}) {
  const router = useRouter();
  const [choice, setChoice] = useState(value ?? "");
  const [prevValue, setPrevValue] = useState(value ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const current = value ?? "";
  if (current !== prevValue) {
    setPrevValue(current);
    setChoice(current);
  }

  function handleChange(next: string) {
    setChoice(next);
    startTransition(async () => {
      const result = await updateTestResultWifiDongle(testId, jobSheetId, next);
      if (result.ok) {
        setMessage(null);
        router.refresh();
      } else {
        setChoice(current);
        setMessage(result.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <select
        value={choice}
        disabled={isPending}
        onChange={(e) => handleChange(e.target.value)}
        className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {message && <p className="text-destructive text-xs">{message}</p>}
    </div>
  );
}
