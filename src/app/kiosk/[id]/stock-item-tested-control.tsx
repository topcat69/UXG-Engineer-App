"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setStockItemTested } from "./actions";

/**
 * Toggleable at any point, not just at goods-in — see setStockItemTested's
 * own comment on why testing often happens later, at Configuring. Tracks
 * its own optimistic `checked` rather than binding straight to the
 * `tested` prop: a plain server-bound checkbox snaps back to unchecked
 * the instant it's clicked (React re-renders with the still-stale prop
 * before the save round-trips and router.refresh() delivers the new
 * value), which reads as the click not registering. The effect re-syncs
 * once the server value actually changes; a failed save reverts.
 */
export function StockItemTestedControl({ stockItemId, jobSheetId, tested }: { stockItemId: string; jobSheetId: string; tested: boolean }) {
  const router = useRouter();
  const [checked, setChecked] = useState(tested);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => setChecked(tested), [tested]);

  function handleToggle(next: boolean) {
    setChecked(next);
    startTransition(async () => {
      const result = await setStockItemTested(stockItemId, jobSheetId, next);
      if (result.ok) {
        setMessage(null);
        router.refresh();
      } else {
        setChecked(tested);
        setMessage(result.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={checked}
          disabled={isPending}
          onChange={(e) => handleToggle(e.target.checked)}
          className="h-4 w-4"
        />
        {checked ? "Yes" : "No"}
      </label>
      {message && <p className="text-destructive text-xs">{message}</p>}
    </div>
  );
}
