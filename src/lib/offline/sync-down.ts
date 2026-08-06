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
 * Pulls this engineer's assigned jobs (RLS already scopes these to the
 * 30-day/14-day window), their sites, and their forms into Dexie. Jobs and
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

  const jobIds = (jobs ?? []).map((j) => j.id);

  const pendingOps = await db.outbox.toArray();
  const pendingJobIds = new Set(
    pendingOps
      .map((op) => ("jobId" in op ? op.jobId : op.type === "install_form_upsert" || op.type === "survey_form_upsert" ? op.row.job_id : undefined))
      .filter((id): id is string => !!id),
  );
  const overwritableJobIds = new Set(jobIdsSafeToOverwrite(jobIds, pendingJobIds));

  const [{ data: installForms, error: installError }, { data: surveyForms, error: surveyError }, { data: jobTasks, error: jobTasksError }] =
    jobIds.length > 0
      ? await Promise.all([
          supabase.from("install_forms").select("*").in("job_id", jobIds),
          supabase.from("survey_forms").select("*").in("job_id", jobIds),
          supabase.from("job_tasks").select("*").in("job_id", jobIds),
        ])
      : [{ data: [], error: null } as const, { data: [], error: null } as const, { data: [], error: null } as const];
  if (installError) throw installError;
  if (surveyError) throw surveyError;
  if (jobTasksError) throw jobTasksError;

  // A task the engineer just ticked/unticked offline has a pending
  // task_toggle op keyed by its own id — pulling the server's stale copy
  // over it would silently discard that tap until the op drains.
  const pendingTaskIds = new Set(
    pendingOps.filter((op) => op.type === "task_toggle").map((op) => op.taskId),
  );

  await db.transaction(
    "rw",
    [db.jobs, db.sites, db.installForms, db.surveyForms, db.jobTasks, db.syncMeta],
    async () => {
      await db.jobs.bulkPut(jobs ?? []);
      await db.sites.bulkPut(sites ?? []);

      for (const row of installForms ?? []) {
        if (row.job_id && overwritableJobIds.has(row.job_id)) await db.installForms.put(row);
      }
      for (const row of surveyForms ?? []) {
        if (row.job_id && overwritableJobIds.has(row.job_id)) await db.surveyForms.put(row);
      }
      for (const row of jobTasks ?? []) {
        if (!pendingTaskIds.has(row.id)) await db.jobTasks.put(row);
      }

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
