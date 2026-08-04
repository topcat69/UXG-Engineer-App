"use client";

import { db, type InstallFormRow, type JobStatus } from "./db";

function uuid(): string {
  return crypto.randomUUID();
}

/**
 * The drain loop replays outbox ops in `createdAt` order, and some ops
 * within the same action are causally dependent (e.g. submit's form upsert
 * must land before its status_event flips the job to "submitted", since
 * RLS then blocks further writes to that job's form). Two ops built from
 * the same `new Date()` collide on the same millisecond, and Dexie has no
 * defined tiebreak for that — it can replay them in either order. Stamping
 * each op in a batch with `now + index` milliseconds keeps the event's own
 * timestamp fields (actual_start, occurred_at, etc.) exact while giving the
 * outbox a strict, causally-correct replay order.
 */
function batchTimestamps(now: Date, count: number): string[] {
  return Array.from({ length: count }, (_, i) => new Date(now.getTime() + i).toISOString());
}

export type GeoPoint = { latitude: number; longitude: number };

/**
 * Check In and Start Work chained into one tap, per the AppSheet action
 * spec ("Chain Check In → Start Work so a single tap does both — every tap
 * you remove from the field workflow is worth more than any feature you
 * add"). Writes to the local Dexie job row immediately (optimistic, so the
 * UI updates offline) and queues the matching server-side operations.
 */
export async function checkIn(
  jobId: string,
  geofenceVarianceM: number | null,
  point: GeoPoint | null,
): Promise<void> {
  const job = await db.jobs.get(jobId);
  if (!job) throw new Error("Job not found locally");
  const now = new Date();
  const nowIso = now.toISOString();
  const [patchCreatedAt, eventCreatedAt] = batchTimestamps(now, 2);

  await db.transaction("rw", [db.jobs, db.outbox], async () => {
    await db.jobs.update(jobId, {
      status: "in_progress",
      actual_start: nowIso,
      check_in_lat: point?.latitude ?? null,
      check_in_lng: point?.longitude ?? null,
      geofence_variance_m: geofenceVarianceM,
    });

    await db.outbox.add({
      id: uuid(),
      type: "job_patch",
      jobId,
      patch: {
        actual_start: nowIso,
        check_in_lat: point?.latitude ?? null,
        check_in_lng: point?.longitude ?? null,
        geofence_variance_m: geofenceVarianceM,
      },
      createdAt: patchCreatedAt,
      attempts: 0,
    });
    await db.outbox.add({
      id: uuid(),
      type: "status_event",
      jobId,
      fromStatus: job.status,
      toStatus: "in_progress",
      reason: "Checked in",
      occurredAt: nowIso,
      latitude: point?.latitude,
      longitude: point?.longitude,
      createdAt: eventCreatedAt,
      attempts: 0,
    });
  });
}

/** Persists the in-progress form draft locally. Called on a 15s timer and on capture events. */
export async function saveInstallFormDraft(row: InstallFormRow): Promise<void> {
  await db.installForms.put(row);
}

/**
 * Check Out & Submit: finalizes the form and marks the job submitted. Media
 * still outstanding keeps uploading independently — per the non-negotiable
 * rule, submission never blocks on it. media_pending itself is never set
 * here: it's a pure +1-at-capture/-1-at-upload counter (see
 * media-capture.ts and outbox.ts's media_pending_delta), because photos
 * upload eagerly and can finish — and decrement — before Submit is even
 * tapped, so assigning an absolute count here could stomp those decrements.
 */
export async function submitJob(jobId: string, formRow: InstallFormRow, point: GeoPoint | null): Promise<void> {
  const job = await db.jobs.get(jobId);
  if (!job) throw new Error("Job not found locally");
  const now = new Date();
  const nowIso = now.toISOString();
  const submittedForm = { ...formRow, submitted_at: nowIso };
  // install_form_upsert must be replayed before status_event: once the
  // latter lands, the job's status is "submitted" and RLS blocks any
  // further install_forms write from this engineer.
  const [formCreatedAt, patchCreatedAt, eventCreatedAt] = batchTimestamps(now, 3);

  await db.transaction("rw", [db.jobs, db.installForms, db.outbox], async () => {
    await db.installForms.put(submittedForm);
    await db.jobs.update(jobId, {
      status: "submitted" as JobStatus,
      actual_end: nowIso,
    });

    await db.outbox.add({
      id: uuid(),
      type: "install_form_upsert",
      row: submittedForm,
      createdAt: formCreatedAt,
      attempts: 0,
    });
    await db.outbox.add({
      id: uuid(),
      type: "job_patch",
      jobId,
      patch: { actual_end: nowIso },
      createdAt: patchCreatedAt,
      attempts: 0,
    });
    await db.outbox.add({
      id: uuid(),
      type: "status_event",
      jobId,
      fromStatus: job.status,
      toStatus: "submitted",
      reason: "Submitted from field",
      occurredAt: nowIso,
      latitude: point?.latitude,
      longitude: point?.longitude,
      createdAt: eventCreatedAt,
      attempts: 0,
    });
  });
}
