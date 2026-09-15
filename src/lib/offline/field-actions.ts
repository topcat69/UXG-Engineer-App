"use client";

import { db, type InstallFormRow, type JobDetailsRow, type JobStatus, type SurveyActionRow, type SurveyFormRow, type SurveyScreenRow } from "./db";
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
export async function startTravelling(jobId: string, point: GeoPoint, userId: string): Promise<void> {
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
      userId,
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
  userId: string,
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
      userId,
      reason: "Checked in",
      occurredAt: nowIso,
      latitude: point?.latitude,
      longitude: point?.longitude,
      createdAt: eventCreatedAt,
      attempts: 0,
    });
  });
}

/**
 * Stops the clock on a multi-day job without submitting it — otherwise a
 * job checked in Monday and not submitted until Wednesday reports ~48
 * hours "worked" (a plain actual_end - actual_start subtraction has no
 * notion of an overnight gap). `to_status: "on_hold"` and a required
 * reason, per the office's own decision (a paused job could be for a
 * multitude of reasons — waiting on parts, site closed, end of shift — and
 * that's worth capturing every time, not just optionally). No GPS: pause/
 * resume isn't one of the three moments (check-in, check-out, media
 * capture) this app's non-negotiable "GPS only at those three points" rule
 * covers, so none is requested or stored here. See worked-duration.ts for
 * how the actual hours-worked figure is computed back out of the
 * resulting status_events history.
 */
export async function pauseJob(jobId: string, reason: string, userId: string): Promise<void> {
  const job = await db.jobs.get(jobId);
  if (!job) throw new Error("Job not found locally");
  const nowIso = new Date().toISOString();

  await db.transaction("rw", [db.jobs, db.outbox], async () => {
    await db.jobs.update(jobId, { status: "on_hold" });
    await db.outbox.add({
      id: uuid(),
      type: "status_event",
      jobId,
      fromStatus: job.status,
      toStatus: "on_hold",
      userId,
      reason,
      occurredAt: nowIso,
      createdAt: nowIso,
      attempts: 0,
    });
  });
}

/** The other half of pauseJob — resumes a paused job back to in_progress, opening a fresh worked-duration interval. */
export async function resumeJob(jobId: string, userId: string): Promise<void> {
  const job = await db.jobs.get(jobId);
  if (!job) throw new Error("Job not found locally");
  const nowIso = new Date().toISOString();

  await db.transaction("rw", [db.jobs, db.outbox], async () => {
    await db.jobs.update(jobId, { status: "in_progress" });
    await db.outbox.add({
      id: uuid(),
      type: "status_event",
      jobId,
      fromStatus: job.status,
      toStatus: "in_progress",
      userId,
      reason: "Resumed",
      occurredAt: nowIso,
      createdAt: nowIso,
      attempts: 0,
    });
  });
}

/**
 * Persists the in-progress form draft locally (on a 15s timer and on
 * capture events) AND queues a matching upsert outbox op under a fixed,
 * per-job id — otherwise the draft exists nowhere but this device's own
 * Dexie cache, with no outbox op referencing it, so the sync engine's own
 * periodic syncDown() (every 30s, or on reopening the app) sees no reason
 * not to overwrite it with the server's still-empty pre-submission copy,
 * silently erasing everything the engineer just typed — exactly what
 * "close the job and reopen it, my answers are gone" was. Reusing the same
 * outbox id every tick (rather than a fresh one) means editing for several
 * minutes only ever has one pending draft-upsert queued, not a pile of
 * superseded ones; draining it pushes the exact same content the sync
 * engine is about to pull back down, so the round trip changes nothing.
 * See DECISIONS.md for the full trace of why this was silently losing data.
 */
export async function saveInstallFormDraft(row: InstallFormRow): Promise<void> {
  await db.transaction("rw", [db.installForms, db.outbox], async () => {
    await db.installForms.put(row);
    const opId = `draft-install-${row.job_id}`;
    const existing = await db.outbox.get(opId);
    await db.outbox.put({
      id: opId,
      type: "install_form_upsert",
      row,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      attempts: 0,
    });
  });
}

/** job_details equivalent of saveInstallFormDraft, for install/sla/maintenance/delivery — same reasoning above. */
export async function saveJobDetailsDraft(row: JobDetailsRow): Promise<void> {
  await db.transaction("rw", [db.jobDetails, db.outbox], async () => {
    await db.jobDetails.put(row);
    const opId = `draft-details-${row.job_id}`;
    const existing = await db.outbox.get(opId);
    await db.outbox.put({
      id: opId,
      type: "job_details_upsert",
      row,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      attempts: 0,
    });
  });
}

/**
 * survey_forms equivalent of saveInstallFormDraft/saveJobDetailsDraft, for
 * the header + once-per-survey sections. Must be called (even with an
 * otherwise-empty row) before the first survey_screens/survey_actions row
 * is ever added — those tables' RLS requires a real survey_forms row to
 * already exist server-side, and the outbox replays strictly in createdAt
 * order, so JobWorkflow calls this once eagerly on mount for a survey job
 * rather than waiting for the first 15s autosave tick (see job-workflow.tsx).
 */
export async function saveSurveyFormDraft(row: SurveyFormRow): Promise<void> {
  await db.transaction("rw", [db.surveyForms, db.outbox], async () => {
    await db.surveyForms.put(row);
    const opId = `draft-survey-${row.job_id}`;
    const existing = await db.outbox.get(opId);
    await db.outbox.put({
      id: opId,
      type: "survey_form_upsert",
      row,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      attempts: 0,
    });
  });
}

/**
 * Adds or edits one screen. Unlike the whole-row draft functions above
 * (batched on a 15s timer because a single job_details/install_forms/
 * survey_forms row has dozens of fields that all change together), a
 * screen is small enough — and edited one at a time — that saving on every
 * change is simple and correct: the fixed `draft-screen-${id}` outbox id
 * still collapses rapid edits into one pending op, same collapsing trick,
 * just invoked immediately instead of every 15 seconds.
 */
export async function upsertSurveyScreen(jobId: string, row: SurveyScreenRow): Promise<void> {
  await db.transaction("rw", [db.surveyScreens, db.outbox], async () => {
    await db.surveyScreens.put(row);
    const opId = `draft-screen-${row.id}`;
    const existing = await db.outbox.get(opId);
    await db.outbox.put({
      id: opId,
      type: "survey_screen_upsert",
      jobId,
      row,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      attempts: 0,
    });
  });
}

/** Removes a screen the engineer added by mistake. Drops any still-pending draft-upsert for it first — no point replaying a write for a row about to be deleted. */
export async function deleteSurveyScreen(jobId: string, screenId: string): Promise<void> {
  await db.transaction("rw", [db.surveyScreens, db.outbox], async () => {
    await db.surveyScreens.delete(screenId);
    await db.outbox.delete(`draft-screen-${screenId}`);
    await db.outbox.add({
      id: uuid(),
      type: "survey_screen_delete",
      jobId,
      screenId,
      createdAt: new Date().toISOString(),
      attempts: 0,
    });
  });
}

/** Actions & Follow-up equivalent of upsertSurveyScreen — same reasoning. */
export async function upsertSurveyAction(jobId: string, row: SurveyActionRow): Promise<void> {
  await db.transaction("rw", [db.surveyActions, db.outbox], async () => {
    await db.surveyActions.put(row);
    const opId = `draft-action-${row.id}`;
    const existing = await db.outbox.get(opId);
    await db.outbox.put({
      id: opId,
      type: "survey_action_upsert",
      jobId,
      row,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      attempts: 0,
    });
  });
}

/** Actions & Follow-up equivalent of deleteSurveyScreen — same reasoning. */
export async function deleteSurveyAction(jobId: string, actionId: string): Promise<void> {
  await db.transaction("rw", [db.surveyActions, db.outbox], async () => {
    await db.surveyActions.delete(actionId);
    await db.outbox.delete(`draft-action-${actionId}`);
    await db.outbox.add({
      id: uuid(),
      type: "survey_action_delete",
      jobId,
      actionId,
      createdAt: new Date().toISOString(),
      attempts: 0,
    });
  });
}

/**
 * survey_forms equivalent of submitJob/submitJobDetails — Check Out &
 * Submit for a survey job. No auto-issue detection: unlike install/sla/
 * maintenance's pass/fail checks, nothing on a survey implies a defect to
 * raise automatically. No signature either — a survey is an internal
 * record, not customer sign-off, so JobWorkflow doesn't require one for
 * job_type "survey" (see validateSurveyForm in lib/forms/survey-form.ts).
 */
export async function submitSurveyForm(
  jobId: string,
  surveyRow: SurveyFormRow,
  point: GeoPoint | null,
  raisedBy: string,
): Promise<void> {
  const job = await db.jobs.get(jobId);
  if (!job) throw new Error("Job not found locally");
  const now = new Date();
  const nowIso = now.toISOString();
  const submittedSurvey = { ...surveyRow, submitted_at: nowIso };
  const [surveyCreatedAt, patchCreatedAt, eventCreatedAt] = batchTimestamps(now, 3);

  await db.transaction("rw", [db.jobs, db.surveyForms, db.outbox], async () => {
    await db.surveyForms.put(submittedSurvey);
    await db.jobs.update(jobId, {
      status: "submitted" as JobStatus,
      actual_end: nowIso,
    });

    // See the matching comment in submitJob above — collapses any still-
    // pending pre-submission draft op into this final write.
    await db.outbox.put({
      id: `draft-survey-${jobId}`,
      type: "survey_form_upsert",
      row: submittedSurvey,
      createdAt: surveyCreatedAt,
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
      userId: raisedBy,
      reason: "Submitted from field",
      occurredAt: nowIso,
      latitude: point?.latitude,
      longitude: point?.longitude,
      createdAt: eventCreatedAt,
      attempts: 0,
    });
  });
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

    // Reuses saveInstallFormDraft's fixed per-job id, via put rather than
    // add, so this collapses any still-pending pre-submission draft op into
    // this final write instead of leaving it queued alongside it. A
    // leftover draft op would retry forever once the status_event below
    // lands and RLS permanently blocks any further engineer write to this
    // job's install_forms row — see isFormWriteLocked in outbox.ts, which
    // guards against this too, but there's no reason to leave anything
    // behind for it to have to catch in the first place.
    await db.outbox.put({
      id: `draft-install-${jobId}`,
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
      userId: raisedBy,
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

    // See the matching comment in submitJob above — collapses any still-
    // pending pre-submission draft op into this final write.
    await db.outbox.put({
      id: `draft-details-${jobId}`,
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
      userId: raisedBy,
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
