"use client";

import { createClient } from "@/lib/supabase/client";
import { db } from "./db";

/**
 * Which job ids fetched from the server are safe to overwrite locally.
 * A job with a pending (not-yet-synced) outbox operation is excluded —
 * pulling the server's stale copy over it would silently discard offline
 * work in progress. Pure and DB-free so it's unit-testable directly.
 */
export function jobIdsSafeToOverwrite(fetchedJobIds: string[], pendingJobIds: ReadonlySet<string>): string[] {
  return fetchedJobIds.filter((id) => !pendingJobIds.has(id));
}

export type SyncDownResult = { jobCount: number; siteCount: number };

/**
 * Pulls this engineer's assigned jobs (RLS already scopes these to a
 * ±30-day window — see 20260129000000_widen_engineer_job_window.sql),
 * their sites, and their forms into Dexie. Jobs and
 * sites are server-authoritative and always overwritten; install/survey
 * forms are only overwritten for jobs with no pending outbox operation, so
 * a sync-down never clobbers an in-progress offline form edit.
 */
export async function syncDown(userId: string): Promise<SyncDownResult> {
  const supabase = createClient();

  const { data: jobs, error: jobsError } = await supabase.from("jobs").select("*").eq("assigned_to", userId);
  if (jobsError) throw jobsError;

  const siteIds = Array.from(new Set((jobs ?? []).map((j) => j.site_id)));
  const { data: sites, error: sitesError } =
    siteIds.length > 0 ? await supabase.from("sites").select("*").in("id", siteIds) : { data: [], error: null };
  if (sitesError) throw sitesError;

  // The engineer needs the client's name alongside the site name for
  // context — a site name alone (e.g. "Store 42") doesn't say who it's for.
  const clientIds = Array.from(new Set((sites ?? []).map((s) => s.client_id)));
  const { data: clients, error: clientsError } =
    clientIds.length > 0 ? await supabase.from("clients").select("*").in("id", clientIds) : { data: [], error: null };
  if (clientsError) throw clientsError;

  const jobIds = (jobs ?? []).map((j) => j.id);

  const pendingOps = await db.outbox.toArray();
  const pendingJobIds = new Set(
    pendingOps
      .map((op) =>
        "jobId" in op
          ? op.jobId
          : op.type === "install_form_upsert" || op.type === "survey_form_upsert" || op.type === "job_details_upsert"
            ? op.row.job_id
            : undefined,
      )
      .filter((id): id is string => !!id),
  );
  const overwritableJobIds = new Set(jobIdsSafeToOverwrite(jobIds, pendingJobIds));

  const [
    { data: installForms, error: installError },
    { data: surveyForms, error: surveyError },
    { data: jobTasks, error: jobTasksError },
    { data: jobDetails, error: jobDetailsError },
    { data: jobEquipment, error: jobEquipmentError },
    { data: jobOptionalFields, error: jobOptionalFieldsError },
  ] =
    jobIds.length > 0
      ? await Promise.all([
          supabase.from("install_forms").select("*").in("job_id", jobIds),
          supabase.from("survey_forms").select("*").in("job_id", jobIds),
          supabase.from("job_tasks").select("*").in("job_id", jobIds),
          supabase.from("job_details").select("*").in("job_id", jobIds),
          // Office-prepared, engineer never writes it, so there's no
          // pending-outbox guard needed the way install_forms/job_details have.
          supabase.from("job_equipment").select("*").in("job_id", jobIds),
          // Same as job_equipment above — a manager's mandatory/optional
          // toggle, never written by the engineer.
          supabase.from("job_optional_fields").select("*").in("job_id", jobIds),
        ])
      : [
          { data: [], error: null } as const,
          { data: [], error: null } as const,
          { data: [], error: null } as const,
          { data: [], error: null } as const,
          { data: [], error: null } as const,
          { data: [], error: null } as const,
        ];
  if (installError) throw installError;
  if (surveyError) throw surveyError;
  if (jobTasksError) throw jobTasksError;
  if (jobDetailsError) throw jobDetailsError;
  if (jobEquipmentError) throw jobEquipmentError;
  if (jobOptionalFieldsError) throw jobOptionalFieldsError;

  // A task the engineer just ticked/unticked offline has a pending
  // task_toggle op keyed by its own id — pulling the server's stale copy
  // over it would silently discard that tap until the op drains.
  const pendingTaskIds = new Set(
    pendingOps.filter((op) => op.type === "task_toggle").map((op) => op.taskId),
  );

  await db.transaction(
    "rw",
    [
      db.jobs,
      db.sites,
      db.clients,
      db.installForms,
      db.surveyForms,
      db.jobTasks,
      db.jobDetails,
      db.jobEquipment,
      db.jobOptionalFields,
      db.syncMeta,
    ],
    async () => {
      await db.jobs.bulkPut(jobs ?? []);
      await db.sites.bulkPut(sites ?? []);
      await db.clients.bulkPut(clients ?? []);

      for (const row of installForms ?? []) {
        if (row.job_id && overwritableJobIds.has(row.job_id)) await db.installForms.put(row);
      }
      for (const row of surveyForms ?? []) {
        if (row.job_id && overwritableJobIds.has(row.job_id)) await db.surveyForms.put(row);
      }
      for (const row of jobTasks ?? []) {
        if (!pendingTaskIds.has(row.id)) await db.jobTasks.put(row);
      }
      for (const row of jobDetails ?? []) {
        if (row.job_id && overwritableJobIds.has(row.job_id)) await db.jobDetails.put(row);
      }
      await db.jobEquipment.bulkPut(jobEquipment ?? []);

      // A full replace, not just bulkPut — job_optional_fields is sparse
      // (a row's *absence* means "required"), so a manager re-marking a
      // field mandatory deletes its row server-side; bulkPut alone would
      // never notice that and the stale "optional" row would linger
      // locally, silently letting the engineer skip a field they shouldn't.
      await db.jobOptionalFields.where("job_id").anyOf(jobIds).delete();
      await db.jobOptionalFields.bulkPut(jobOptionalFields ?? []);

      // Drop local jobs that have fallen out of the assigned/windowed set —
      // unless they still have unsynced work, which must survive until drained.
      const freshJobIds = new Set(jobIds);
      const localJobs = await db.jobs.toArray();
      for (const job of localJobs) {
        if (!freshJobIds.has(job.id) && !pendingJobIds.has(job.id)) {
          await db.jobs.delete(job.id);
        }
      }

      await db.syncMeta.put({ key: "lastSyncedAt", value: new Date().toISOString() });
    },
  );

  return { jobCount: jobs?.length ?? 0, siteCount: sites?.length ?? 0 };
}
