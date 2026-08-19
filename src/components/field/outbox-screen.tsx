"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/offline/db";
import { summarizeOutbox } from "@/lib/offline/outbox";
import { estimateStorage } from "@/lib/offline/persistent-storage";
import { humanize } from "@/lib/format/text";

const WARN_USAGE_RATIO = 0.8;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function describeOp(op: { type: string; jobId?: string }): string {
  switch (op.type) {
    case "status_event":
      return "Status change";
    case "job_patch":
      return "Job update";
    case "install_form_upsert":
      return "Install form";
    case "survey_form_upsert":
      return "Survey form";
    case "signature_insert":
      return "Signature";
    case "issue_insert":
      return "Issue";
    default:
      return op.type;
  }
}

export function OutboxScreen({ onBack, onRetry }: { onBack: () => void; onRetry: () => void }) {
  const ops = useLiveQuery(() => db.outbox.orderBy("createdAt").toArray(), [], []);
  // capturedAt isn't an indexed field (mediaQueue is indexed on id/jobId/status
  // only), so orderBy() would throw — sort in JS instead over the small,
  // always-local queue.
  const media = useLiveQuery(
    () => db.mediaQueue.toArray().then((items) => items.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))),
    [],
    [],
  );
  const summary = summarizeOutbox(ops ?? [], media ?? []);

  const [storage, setStorage] = useState<{ usageBytes: number; quotaBytes: number } | null>(null);
  useEffect(() => {
    estimateStorage().then(setStorage);
  }, [ops, media]);

  const [isRetrying, setIsRetrying] = useState(false);
  async function handleRetry() {
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  }

  const storageWarning =
    storage && storage.quotaBytes > 0 && storage.usageBytes / storage.quotaBytes > WARN_USAGE_RATIO;

  return (
    <div className="flex flex-col gap-4 p-4">
      <button type="button" onClick={onBack} className="text-muted-foreground text-sm underline">
        ← Back
      </button>

      <h1 className="text-lg font-semibold">Outbox</h1>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-md border p-3">
          <p className="text-muted-foreground">Pending changes</p>
          <p className="text-xl font-semibold">{summary.pendingOps}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-muted-foreground">Pending media</p>
          <p className="text-xl font-semibold">{summary.pendingMedia}</p>
          <p className="text-muted-foreground">{formatBytes(summary.totalMediaBytes)}</p>
        </div>
      </div>

      <p className="text-muted-foreground text-sm">
        Last attempt: {summary.lastAttemptAt ? new Date(summary.lastAttemptAt).toLocaleString() : "never"}
      </p>

      {summary.failedMedia > 0 && (
        <p className="text-destructive text-sm">{summary.failedMedia} item(s) failed and will retry automatically.</p>
      )}

      {storage && (
        <p className={`text-sm ${storageWarning ? "text-destructive" : "text-muted-foreground"}`}>
          Device storage: {formatBytes(storage.usageBytes)} of {formatBytes(storage.quotaBytes)} used
          {storageWarning ? " — running low, sync soon to free up space." : ""}
        </p>
      )}

      <Button onClick={handleRetry} disabled={isRetrying}>
        {isRetrying ? "Syncing…" : "Retry now"}
      </Button>

      {(summary.pendingOps > 0 || summary.pendingMedia > 0) && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Waiting to sync</p>
          <ul className="flex flex-col gap-2">
            {(ops ?? []).map((op) => (
              <li key={op.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <span>{describeOp(op)}</span>
                <div className="flex items-center gap-2">
                  {op.attempts > 0 && <Badge variant="destructive">{op.attempts} retries</Badge>}
                  <span className="text-muted-foreground text-xs">{new Date(op.createdAt).toLocaleTimeString()}</span>
                </div>
              </li>
            ))}
            {(media ?? [])
              .filter((m) => m.status !== "uploaded")
              .map((m) => (
                <li key={m.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <span>{m.kind === "signature" ? "Signature" : `Photo: ${m.slot.replace("photo_", "").replace(/_/g, " ")}`}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={m.status === "failed" ? "destructive" : "secondary"}>{humanize(m.status)}</Badge>
                    <span className="text-muted-foreground text-xs">{formatBytes(m.bytes)}</span>
                  </div>
                </li>
              ))}
          </ul>
        </div>
      )}

      {summary.pendingOps === 0 && summary.pendingMedia === 0 && (
        <p className="text-muted-foreground text-sm">Everything is synced.</p>
      )}
    </div>
  );
}
