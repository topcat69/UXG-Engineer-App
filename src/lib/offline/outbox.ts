"use client";

import { createClient } from "@/lib/supabase/client";
import { db, type MediaQueueItem, type OutboxOperation } from "./db";

export type DrainResult = { succeeded: number; failed: number };

/**
 * Mirrors the job_details_insert/update and install_forms_insert/update RLS
 * policies' engineer condition exactly (see
 * supabase/migrations/20260117000000_job_details.sql,
 * 20260103000000_rls.sql, and 20260203000000_revisit_status_rls.sql) — once
 * a job reaches one of these statuses, RLS permanently forbids the assigned
 * engineer from writing to its install_forms/job_details row. A leftover
 * draft-upsert op targeting a job already this far along can never succeed
 * no matter how many times it's retried, which was a real bug: a stale
 * draft op left queued from just before submission kept retrying forever
 * after the job's own status_event landed, even though the submit itself
 * (a separate, later op) had already synced the final data successfully.
 */
const FORM_WRITE_LOCKED_STATUSES = new Set(["submitted", "under_review", "approved", "closed", "revisit"]);

/** Pure so this can be unit tested without touching Dexie or Supabase. */
export function isFormWriteLocked(jobStatus: string | undefined): boolean {
  return !!jobStatus && FORM_WRITE_LOCKED_STATUSES.has(jobStatus);
}

/** Replays every pending outbox operation once, in the order it was queued. */
export async function drainOutbox(): Promise<DrainResult> {
  const supabase = createClient();
  const ops = await db.outbox.orderBy("createdAt").toArray();
  let succeeded = 0;
  let failed = 0;

  for (const op of ops) {
    try {
      await applyOperation(supabase, op);
      await db.outbox.delete(op.id);
      succeeded++;
    } catch (error) {
      failed++;
      await db.outbox.update(op.id, {
        attempts: op.attempts + 1,
        lastAttemptAt: new Date().toISOString(),
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { succeeded, failed };
}

async function applyOperation(supabase: ReturnType<typeof createClient>, op: OutboxOperation): Promise<void> {
  switch (op.type) {
    case "status_event": {
      const { error: statusError } = await supabase.from("jobs").update({ status: op.toStatus }).eq("id", op.jobId);
      if (statusError) throw statusError;
      const { error: eventError } = await supabase.from("status_events").insert({
        job_id: op.jobId,
        from_status: op.fromStatus,
        to_status: op.toStatus,
        reason: op.reason,
        occurred_at: op.occurredAt,
        latitude: op.latitude,
        longitude: op.longitude,
      });
      if (eventError) throw eventError;
      return;
    }
    case "job_patch": {
      const { error } = await supabase.from("jobs").update(op.patch).eq("id", op.jobId);
      if (error) throw error;
      return;
    }
    case "install_form_upsert": {
      if (op.row.job_id && isFormWriteLocked((await db.jobs.get(op.row.job_id))?.status)) {
        console.info(`Dropping stale install_form_upsert for job ${op.row.job_id} — already past submission`);
        return;
      }
      const { error } = await supabase.from("install_forms").upsert(op.row);
      if (error) throw error;
      return;
    }
    case "survey_form_upsert": {
      const { error } = await supabase.from("survey_forms").upsert(op.row);
      if (error) throw error;
      return;
    }
    case "job_details_upsert": {
      if (op.row.job_id && isFormWriteLocked((await db.jobs.get(op.row.job_id))?.status)) {
        console.info(`Dropping stale job_details_upsert for job ${op.row.job_id} — already past submission`);
        return;
      }
      const { error } = await supabase.from("job_details").upsert(op.row);
      if (error) throw error;
      return;
    }
    case "signature_insert": {
      const { error } = await supabase.from("signatures").upsert(op.row);
      if (error) throw error;
      return;
    }
    case "issue_insert": {
      const { error } = await supabase.from("issues").upsert(op.row);
      if (error) throw error;
      return;
    }
    case "task_toggle": {
      const { error } = await supabase
        .from("job_tasks")
        .update({ is_done: op.isDone, done_at: op.doneAt, done_by: op.doneBy })
        .eq("id", op.taskId);
      if (error) throw error;
      return;
    }
    case "media_pending_delta": {
      const { error } = await supabase.rpc("adjust_media_pending", { p_job_id: op.jobId, p_delta: op.delta });
      if (error) throw error;
      return;
    }
    case "media_delete": {
      const { error: removeError } = await supabase.storage.from("media").remove([op.storagePath]);
      if (removeError) throw removeError;
      const table = op.kind === "signature" ? "signatures" : "media_assets";
      const { error: deleteError } = await supabase.from(table).delete().eq("id", op.mediaId);
      if (deleteError) throw deleteError;
      return;
    }
  }
}

/**
 * Uploads every queued photo/video/signature to Supabase Storage and writes its
 * media_assets row — per the non-negotiable rule, media never blocks
 * submission, so this always runs independently of the outbox operations
 * queue, on its own retry loop, and can lag behind a job already marked
 * submitted.
 */
export async function drainMediaQueue(): Promise<DrainResult> {
  const supabase = createClient();
  const items = await db.mediaQueue.where("status").notEqual("uploaded").toArray();
  let succeeded = 0;
  let failed = 0;

  for (const item of items) {
    try {
      await db.mediaQueue.update(item.id, { status: "uploading" });

      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(item.storagePath, item.blob, { upsert: true, contentType: item.mime });
      if (uploadError) throw uploadError;

      if (item.kind === "signature") {
        const { error: insertError } = await supabase.from("signatures").upsert({
          id: item.id,
          job_id: item.jobId,
          signer_name: item.signerName ?? "",
          signer_role: item.signerRole ?? "",
          storage_path: item.storagePath,
          signed_at: item.capturedAt,
          latitude: item.latitude,
          longitude: item.longitude,
        });
        if (insertError) throw insertError;
      } else {
        const { error: insertError } = await supabase.from("media_assets").upsert({
          id: item.id,
          job_id: item.jobId,
          slot: item.slot,
          storage_path: item.storagePath,
          media_type: item.kind === "video" ? "video" : "image",
          bytes: item.bytes,
          mime: item.mime,
          captured_at: item.capturedAt,
          uploaded_at: new Date().toISOString(),
          latitude: item.latitude,
          longitude: item.longitude,
          accuracy_m: item.accuracyM,
          sha256: item.sha256,
          captured_by: item.capturedBy,
        });
        if (insertError) throw insertError;
      }

      // Both media (photo/video) and the signature increment media_pending at capture
      // time (see media-capture.ts), so both must decrement it here too.
      await decrementMediaPending(supabase, item.jobId);
      await db.mediaQueue.update(item.id, { status: "uploaded" });
      succeeded++;
    } catch (error) {
      failed++;
      await db.mediaQueue.update(item.id, {
        status: "failed",
        attempts: item.attempts + 1,
        lastAttemptAt: new Date().toISOString(),
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { succeeded, failed };
}

async function decrementMediaPending(supabase: ReturnType<typeof createClient>, jobId: string): Promise<void> {
  // Delta-based (see media_pending_delta in db.ts and adjust_media_pending
  // in supabase/migrations/20260108000000_media_pending_delta.sql) rather
  // than a JS-level read-then-write, which would both race against
  // concurrent decrements and against the increment enqueued at capture
  // time — the two queues drain independently and can interleave in either
  // order.
  const { error } = await supabase.rpc("adjust_media_pending", { p_job_id: jobId, p_delta: -1 });
  if (error) throw error;
}

export type OutboxSummary = {
  pendingOps: number;
  pendingMedia: number;
  failedMedia: number;
  totalMediaBytes: number;
  lastAttemptAt: string | null;
};

/** Pure summarizer for the outbox screen — no I/O, just arithmetic over already-loaded rows. */
export function summarizeOutbox(ops: OutboxOperation[], media: MediaQueueItem[]): OutboxSummary {
  const outstandingMedia = media.filter((m) => m.status !== "uploaded");
  const lastAttempts = [...ops, ...media].map((x) => x.lastAttemptAt).filter((x): x is string => !!x);

  return {
    pendingOps: ops.length,
    pendingMedia: outstandingMedia.length,
    failedMedia: media.filter((m) => m.status === "failed").length,
    totalMediaBytes: outstandingMedia.reduce((sum, m) => sum + m.bytes, 0),
    lastAttemptAt: lastAttempts.length > 0 ? lastAttempts.sort().at(-1)! : null,
  };
}
