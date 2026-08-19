"use client";

import { db, type InstallFormRow, type JobDetailsRow, type JobStatus } from "./db";
import { detectAutoIssues, installFormRowToValues } from "@/lib/forms/install-form";
import { detectAutoIssues as detectJobDetailsAutoIssues, jobDetailsRowToValues, type JobDetailsType } from "@/lib/forms/job-form";
import { generateId } from "./id";

function uuid(): string {
  return generateId();
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
 * "Commence job from beginning of journey" — the spec's other required
 * timestamp, distinct from checkIn's "commence job at customer site"
 * below. Transitions status to "travelling" and stamps
 * actual_travel_start/travel_start_lat/lng, same shape as checkIn (job
 * write + status_event for the audit trail) but with no geofence check,
 * since the engineer isn't at the site yet.
 */
export async function startTravelling(jobId: string, point: GeoPoint): Promise<void> {
  const job = await db.jobs.get(jobId);
  if (!job) throw new Error("Job not found locally");
  const now = new Date();
  const nowIso = now.toISOString();
  const [patchCreatedAt, eventCreatedAt] = batchTimestamps(now, 2);

  await db.transaction("rw", [db.jobs, db.outbox], async () => {
    await db.jobs.update(jobId, {
      status: "travelling",
      actual_travel_start: nowIso,
      travel_start_lat: point.latitude,
      travel_start_lng: point.longitude,
    });

    await db.outbox.add({
      id: uuid(),
      type: "job_patch",
      jobId,
      patch: {
        actual_travel_start: nowIso,
        travel_start_lat: point.latitude,
        travel_start_lng: point.longitude,
      },
      createdAt: patchCreatedAt,
      attempts: 0,
    });
    await db.outbox.add({
      id: uuid(),
      type: "status_event",
      jobId,
      fromStatus: job.status,
      toStatus: "travelling",
      reason: "Started travelling",
      occurredAt: nowIso,
      latitude: point.latitude,
      longitude: point.longitude,
      createdAt: eventCreatedAt,
      attempts: 0,
    });
  });
}

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

/** job_details equivalent of saveInstallFormDraft, for install/sla/maintenance/delivery. */
export async function saveJobDetailsDraft(row: JobDetailsRow): Promise<void> {
  await db.jobDetails.put(row);
}

/** Ticks/unticks a job task. Optimistic local write + queued outbox op, same shape as checkIn. */
export async function toggleTask(taskId: string, jobId: string, isDone: boolean, userId: string): Promise<void> {
  const nowIso = new Date().toISOString();
  const doneAt = isDone ? nowIso : null;
  const doneBy = isDone ? userId : null;

  await db.transaction("rw", [db.jobTasks, db.outbox], async () => {
    await db.jobTasks.update(taskId, { is_done: isDone, done_at: doneAt, done_by: doneBy });
    await db.outbox.add({
      id: uuid(),
      type: "task_toggle",
      taskId,
      jobId,
      isDone,
      doneAt,
      doneBy,
      createdAt: nowIso,
      attempts: 0,
    });
  });
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
export async function submitJob(
  jobId: string,
  formRow: InstallFormRow,
  point: GeoPoint | null,
  raisedBy: string,
): Promise<void> {
  const job = await db.jobs.get(jobId);
  if (!job) throw new Error("Job not found locally");
  const now = new Date();
  const nowIso = now.toISOString();
  const submittedForm = { ...formRow, submitted_at: nowIso };
  // Per spec: raise issue manually (the engineer's own issues_found note)
  // or automatically (a failed pass/fail check) — both surface here since
  // this is the one place the completed form values are known.
  const autoIssues = detectAutoIssues(installFormRowToValues(formRow));
  // install_form_upsert must be replayed before status_event: once the
  // latter lands, the job's status is "submitted" and RLS blocks any
  // further install_forms write from this engineer. Issue inserts have no
  // such dependency, so they're just appended after.
  const [formCreatedAt, patchCreatedAt, eventCreatedAt, ...issueCreatedAts] = batchTimestamps(
    now,
    3 + autoIssues.length,
  );

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

    for (const [index, issue] of autoIssues.entries()) {
      await db.outbox.add({
        id: uuid(),
        type: "issue_insert",
        row: {
          id: uuid(),
          job_id: jobId,
          site_id: job.site_id,
          raised_by: raisedBy,
          severity: issue.severity,
          category: "install",
          description: issue.description,
          blocks_completion: issue.blocksCompletion,
          status: "open",
          resolved_at: null,
          revisit_job_id: null,
          created_at: nowIso,
        },
        createdAt: issueCreatedAts[index],
        attempts: 0,
      });
    }
  });
}

/**
 * job_details equivalent of submitJob, for install/sla/maintenance/delivery
 * — same shape (form upsert must replay before the status_event flips the
 * job to "submitted" and RLS locks further writes; issue inserts have no
 * such ordering dependency), parameterised by job type since which
 * fields/sections apply — and therefore which auto-issues can even fire —
 * differs per type (see job-form.ts).
 */
export async function submitJobDetails(
  jobId: string,
  jobType: JobDetailsType,
  detailsRow: JobDetailsRow,
  point: GeoPoint | null,
  raisedBy: string,
): Promise<void> {
  const job = await db.jobs.get(jobId);
  if (!job) throw new Error("Job not found locally");
  const now = new Date();
  const nowIso = now.toISOString();
  const submittedDetails = { ...detailsRow, submitted_at: nowIso };
  const autoIssues = detectJobDetailsAutoIssues(jobType, jobDetailsRowToValues(detailsRow));
  const [detailsCreatedAt, patchCreatedAt, eventCreatedAt, ...issueCreatedAts] = batchTimestamps(
    now,
    3 + autoIssues.length,
  );

  await db.transaction("rw", [db.jobs, db.jobDetails, db.outbox], async () => {
    await db.jobDetails.put(submittedDetails);
    await db.jobs.update(jobId, {
      status: "submitted" as JobStatus,
      actual_end: nowIso,
    });

    await db.outbox.add({
      id: uuid(),
      type: "job_details_upsert",
      row: submittedDetails,
      createdAt: detailsCreatedAt,
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

    for (const [index, issue] of autoIssues.entries()) {
      await db.outbox.add({
        id: uuid(),
        type: "issue_insert",
        row: {
          id: uuid(),
          job_id: jobId,
          site_id: job.site_id,
          raised_by: raisedBy,
          severity: issue.severity,
          category: jobType,
          description: issue.description,
          blocks_completion: issue.blocksCompletion,
          status: "open",
          resolved_at: null,
          revisit_job_id: null,
          created_at: nowIso,
        },
        createdAt: issueCreatedAts[index],
        attempts: 0,
      });
    }
  });
}
