"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { signOffJobSheet } from "./actions";

export function SignOffPanel({
  jobSheetId,
  signedOffByName,
  signedOffAt,
}: {
  jobSheetId: string;
  signedOffByName: string | null;
  signedOffAt: string | null;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (signedOffByName && signedOffAt) {
    return (
      <p className="text-sm">
        Signed off by <span className="font-medium">{signedOffByName}</span> on {new Date(signedOffAt).toLocaleString()}
      </p>
    );
  }

  function handleSignOff() {
    startTransition(async () => {
      const result = await signOffJobSheet(jobSheetId);
      if (result.ok) {
        router.refresh();
      } else {
        setMessage(result.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" size="sm" disabled={isPending} onClick={handleSignOff}>
        {isPending ? "Signing off…" : "Sign off & mark Ready"}
      </Button>
      {message && <p className="text-destructive text-sm">{message}</p>}
    </div>
  );
}
