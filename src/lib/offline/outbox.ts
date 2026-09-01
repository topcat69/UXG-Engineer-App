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
 * engineer from writing to its install_forms/job_details row, so retrying a
 * write that's already failed for one of these jobs would just fail forever.
 *
 * Used in applyOperation's install_form_upsert/job_details_upsert cases only
 * *after* an upsert attempt has actually failed — never pre-emptively.
 * submitJob/submitJobDetails set the job's local status to "submitted" in
 * the very same Dexie transaction that queues that op (see field-actions.ts),
 * so checking status before attempting the write would treat every job's
 * own final, legitimate submit write as already stale and silently drop it
 * without it ever reaching the server — a real bug this used to have,
 * caught by job-reports.spec.ts intermittently: whether it "worked" came
 * down to whether the 15s field-app autosave happened to have already
 * synced the same data earlier by coincidence, not anything about the
 * submit write itself.
 */
const FORM_WRITE_LOCKED_STATUSES = new Set(["submitted", "under_review", "approved", "closed", "revisit"]);

/** Pure so this can be unit tested without touching Dexie or Supabase. */
export function isFormWriteLocked(jobStatus: string | undefined): boolean {
  return !!jobStatus && FORM_WRITE_LOCKED_STATUSES.has(jobStatus);
}

/**
 * Which job an op belongs to, for the same-job ordering guard below. Pure
 * so it's unit testable without touching Dexie or Supabase.
 */
export function jobIdForOp(op: OutboxOperation): string | null {
  switch (op.type) {
    case "status_event":
    case "job_patch":
    case "task_toggle":
    case "media_pending_delta":
    case "media_delete":
      return op.jobId;
    case "install_form_upsert":
    case "survey_form_upsert":
    case "job_details_upsert":
    case "signature_insert":
    case "issue_insert":
      return op.row.job_id;
  }
}

/**
 * Replays every pending outbox operation once, in the order it was queued.
 *
 * Ops for the same job can be causally dependent on each other in that
 * createdAt order — e.g. submit's job_details/install_forms upsert is
 * timestamped just before its status_event, specifically so it lands
 * before the status flips to "submitted" and RLS locks the form row (see
 * batchTimestamps in field-actions.ts). But createdAt order alone doesn't
 * enforce that: each op here is applied and errors independently, so
 * without this guard a transient failure on the form write wouldn't stop
 * the loop — the later status_event would still go on to succeed right
 * after it, on the very next iteration. That silently produces a job that
 * reads "submitted" on the server with its form data still missing, for
 * as long as it takes the next retry (the 30s foreground timer, or the
 * next visibility/online event) to pick the failed op back up — a real
 * gap, not just a slow one, since nothing else here was waiting on it.
 * Once any op for a job fails, every later op for that same job is
 * skipped for the rest of this pass (left queued, untouched, to be tried
 * again next drain in the same order) rather than risking exactly that.
 */
export async function drainOutbox(): Promise<DrainResult> {
  const supabase = createClient();
  const ops = await db.outbox.orderBy("createdAt").toArray();
  let succeeded = 0;
  let failed = 0;
  const blockedJobIds = new Set<string>();

  for (const op of ops) {
    const jobId = jobIdForOp(op);
    if (jobId && blockedJobIds.has(jobId)) {
      failed++;
      continue;
    }
    try {
      await applyOperation(supabase, op);
      await db.outbox.delete(op.id);
      succeeded++;
    } catch (error) {
      failed++;
      if (jobId) blockedJobIds.add(jobId);
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
      const { error } = await supabase.from("install_forms").upsert(op.row);
      if (error) {
        // Only drop-as-stale (don't retry) once the write has actually
        // failed AND the job has moved past submission — not pre-emptively.
        // submitJob sets the job's local status to "submitted" in the same
        // Dexie transaction that queues this very op (see field-actions.ts),
        // so checking status before even attempting the write would treat
        // every job's own final, legitimate submit write as already stale
        // and silently drop it without ever reaching the server — that was
        // a real bug (see isFormWriteLocked's doc comment for the scenario
        // this guard is actually meant to catch: a genuinely superseded
        // draft, not the final write itself).
        if (op.row.job_id && isFormWriteLocked((await db.jobs.get(op.row.job_id))?.status)) {
          console.info(`Dropping stale install_form_upsert for job ${op.row.job_id} — already past submission`);
          return;
        }
        throw error;
      }
      return;
    }
    case "survey_form_upsert": {
      const { error } = await supabase.from("survey_forms").upsert(op.row);
      if (error) throw error;
      return;
    }
    case "job_details_upsert": {
      const { error } = await supabase.from("job_details").upsert(op.row);
      if (error) {
        // See the matching comment on install_form_upsert above — same fix,
        // same underlying bug (submitJobDetails sets local status the same
        // way).
        if (op.row.job_id && isFormWriteLocked((await db.jobs.get(op.row.job_id))?.status)) {
          console.info(`Dropping stale job_details_upsert for job ${op.row.job_id} — already past submission`);
          return;
        }
        throw error;
      }
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
