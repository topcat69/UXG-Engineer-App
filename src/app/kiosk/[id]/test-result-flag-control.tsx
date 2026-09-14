"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTestResultFlag, type TestResultFlagKey } from "./actions";

/**
 * One checkbox, any of the Configuration row's boolean fields — same
 * optimistic-toggle pattern as StockItemTestedControl (render-time state
 * adjustment, not a useEffect) so a click sticks immediately instead of
 * snapping back to the still-stale prop before the save round-trips.
 */
export function TestResultFlagControl({
  testId,
  jobSheetId,
  field,
  value,
  label,
}: {
  testId: string;
  jobSheetId: string;
  field: TestResultFlagKey;
  value: boolean | null;
  label: string;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState(value ?? false);
  const [prevValue, setPrevValue] = useState(value ?? false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const current = value ?? false;
  if (current !== prevValue) {
    setPrevValue(current);
    setChecked(current);
  }

  function handleToggle(next: boolean) {
    setChecked(next);
    startTransition(async () => {
      const result = await updateTestResultFlag(testId, jobSheetId, field, next);
      if (result.ok) {
        setMessage(null);
        router.refresh();
      } else {
        setChecked(current);
        setMessage(result.message);
      }
    });
  }

  return (
    <label className="flex items-center gap-1.5 text-sm whitespace-nowrap">
      <input type="checkbox" checked={checked} disabled={isPending} onChange={(e) => handleToggle(e.target.checked)} className="h-4 w-4" />
      {label}
      {message && <span className="text-destructive text-xs">{message}</span>}
    </label>
  );
}
