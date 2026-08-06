import Dexie, { type EntityTable, type Table } from "dexie";
import type { Database } from "@/lib/supabase/database.types";

export type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
export type SiteRow = Database["public"]["Tables"]["sites"]["Row"];
export type InstallFormRow = Database["public"]["Tables"]["install_forms"]["Row"];
export type SurveyFormRow = Database["public"]["Tables"]["survey_forms"]["Row"];
export type SignatureRow = Database["public"]["Tables"]["signatures"]["Row"];
export type IssueRow = Database["public"]["Tables"]["issues"]["Row"];
export type JobTaskRow = Database["public"]["Tables"]["job_tasks"]["Row"];
export type JobStatus = Database["public"]["Enums"]["job_status"];

type OutboxBase = {
  id: string;
  createdAt: string;
  attempts: number;
  lastAttemptAt?: string;
  lastError?: string;
};

/**
 * Every offline mutation, whatever its shape, becomes one of these. The
 * drain loop (src/lib/offline/sync.ts) switches on `type` and replays each
 * one against Supabase — so this is the full menu of things the field app
 * can do while offline.
 */
export type OutboxOperation = OutboxBase &
  (
    | {
        type: "status_event";
        jobId: string;
        fromStatus: JobStatus | null;
        toStatus: JobStatus;
        reason?: string;
        occurredAt: string;
        latitude?: number;
        longitude?: number;
      }
    | { type: "job_patch"; jobId: string; patch: Partial<JobRow> }
    | { type: "install_form_upsert"; row: InstallFormRow }
    | { type: "survey_form_upsert"; row: SurveyFormRow }
    | { type: "signature_insert"; row: SignatureRow }
    | { type: "issue_insert"; row: IssueRow }
    | { type: "task_toggle"; taskId: string; jobId: string; isDone: boolean; doneAt: string | null; doneBy: string | null }
    // Queued instead of applied directly because enqueuePhoto/enqueueSignature
    // must work fully offline. See adjust_media_pending() in
    // supabase/migrations/20260108000000_media_pending_delta.sql for why this
    // is a delta rather than an absolute set.
    | { type: "media_pending_delta"; jobId: string; delta: number }
  );

export type MediaQueueItem = {
  id: string;
  jobId: string;
  /** "photo" uploads land in media_assets on sync; "signature" lands in signatures. */
  kind: "photo" | "signature";
  slot: string;
  blob: Blob;
  mime: string;
  bytes: number;
  capturedAt: string;
  latitude?: number;
  longitude?: number;
  accuracyM?: number;
  sha256: string;
  capturedBy: string;
  storagePath: string;
  status: "pending" | "uploading" | "uploaded" | "failed";
  attempts: number;
  lastAttemptAt?: string;
  lastError?: string;
  // signature-only
  signerName?: string;
  signerRole?: string;
};

export type SyncMeta = {
  key: string;
  value: string;
};

class OfflineDB extends Dexie {
  jobs!: EntityTable<JobRow, "id">;
  sites!: EntityTable<SiteRow, "id">;
  installForms!: EntityTable<InstallFormRow, "id">;
  surveyForms!: EntityTable<SurveyFormRow, "id">;
  outbox!: Table<OutboxOperation, string>;
  mediaQueue!: EntityTable<MediaQueueItem, "id">;
  syncMeta!: EntityTable<SyncMeta, "key">;
  jobTasks!: EntityTable<JobTaskRow, "id">;

  constructor() {
    super("uxg-engineer-job-scheduler");
    this.version(1).stores({
      jobs: "id, status, assigned_to, scheduled_start, site_id",
      sites: "id",
      installForms: "id, job_id",
      surveyForms: "id, job_id",
      outbox: "id, createdAt",
      mediaQueue: "id, jobId, status",
      syncMeta: "key",
    });
    this.version(2).stores({
      jobs: "id, status, assigned_to, scheduled_start, site_id",
      sites: "id",
      installForms: "id, job_id",
      surveyForms: "id, job_id",
      outbox: "id, createdAt",
      mediaQueue: "id, jobId, status",
      syncMeta: "key",
      jobTasks: "id, job_id, is_done",
    });
  }
}

export const db = new OfflineDB();
