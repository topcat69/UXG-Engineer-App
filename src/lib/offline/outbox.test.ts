import { describe, expect, it } from "vitest";
import type { MediaQueueItem, OutboxOperation } from "./db";
import { isFormWriteLocked, jobIdForOp, summarizeOutbox } from "./outbox";

function op(overrides: Partial<OutboxOperation> = {}): OutboxOperation {
  return {
    id: "op-1",
    type: "job_patch",
    jobId: "job-1",
    patch: {},
    createdAt: "2026-08-05T09:00:00Z",
    attempts: 0,
    ...overrides,
  } as OutboxOperation;
}

function media(overrides: Partial<MediaQueueItem> = {}): MediaQueueItem {
  return {
    id: "media-1",
    jobId: "job-1",
    kind: "photo",
    slot: "photo_before",
    blob: new Blob(["x"]),
    mime: "image/jpeg",
    bytes: 1000,
    capturedAt: "2026-08-05T09:00:00Z",
    sha256: "abc",
    capturedBy: "engineer-1",
    storagePath: "jobs/job-1/photo_before.jpg",
    status: "pending",
    attempts: 0,
    ...overrides,
  };
}

describe("summarizeOutbox", () => {
  it("counts pending ops and outstanding media, summing only outstanding bytes", () => {
    const summary = summarizeOutbox(
      [op({ id: "op-1" }), op({ id: "op-2" })],
      [media({ id: "m1", bytes: 1000, status: "pending" }), media({ id: "m2", bytes: 2000, status: "uploaded" })],
    );
    expect(summary.pendingOps).toBe(2);
    expect(summary.pendingMedia).toBe(1);
    expect(summary.totalMediaBytes).toBe(1000);
  });

  it("counts failed media separately from pending", () => {
    const summary = summarizeOutbox(
      [],
      [media({ id: "m1", status: "failed" }), media({ id: "m2", status: "pending" })],
    );
    expect(summary.failedMedia).toBe(1);
    expect(summary.pendingMedia).toBe(2);
  });

  it("returns null lastAttemptAt when nothing has been attempted yet", () => {
    const summary = summarizeOutbox([op()], [media()]);
    expect(summary.lastAttemptAt).toBeNull();
  });

  it("returns the most recent attempt across both queues", () => {
    const summary = summarizeOutbox(
      [op({ lastAttemptAt: "2026-08-05T09:00:00Z" })],
      [media({ lastAttemptAt: "2026-08-05T10:00:00Z" })],
    );
    expect(summary.lastAttemptAt).toBe("2026-08-05T10:00:00Z");
  });

  it("returns zeros for empty queues", () => {
    const summary = summarizeOutbox([], []);
    expect(summary).toEqual({
      pendingOps: 0,
      pendingMedia: 0,
      failedMedia: 0,
      totalMediaBytes: 0,
      lastAttemptAt: null,
    });
  });
});

describe("isFormWriteLocked", () => {
  it("is locked once a job has reached a status RLS blocks engineer writes at", () => {
    expect(isFormWriteLocked("submitted")).toBe(true);
    expect(isFormWriteLocked("under_review")).toBe(true);
    expect(isFormWriteLocked("approved")).toBe(true);
    expect(isFormWriteLocked("closed")).toBe(true);
    expect(isFormWriteLocked("revisit")).toBe(true);
  });

  it("is not locked for any status the engineer can still edit through", () => {
    expect(isFormWriteLocked("draft")).toBe(false);
    expect(isFormWriteLocked("scheduled")).toBe(false);
    expect(isFormWriteLocked("in_progress")).toBe(false);
    expect(isFormWriteLocked("on_hold")).toBe(false);
    expect(isFormWriteLocked("on_site")).toBe(false);
  });

  it("is not locked when the job's status is unknown (not found locally)", () => {
    expect(isFormWriteLocked(undefined)).toBe(false);
  });
});

describe("jobIdForOp", () => {
  it("reads jobId directly off ops that carry it as a top-level field", () => {
    expect(jobIdForOp(op({ type: "job_patch", jobId: "job-1", patch: {} }))).toBe("job-1");
    expect(
      jobIdForOp(op({ type: "status_event", jobId: "job-2", fromStatus: null, toStatus: "submitted", occurredAt: "2026-08-05T09:00:00Z" })),
    ).toBe("job-2");
    expect(jobIdForOp(op({ type: "task_toggle", jobId: "job-3", taskId: "task-1", isDone: true, doneAt: null, doneBy: null }))).toBe(
      "job-3",
    );
    expect(jobIdForOp(op({ type: "media_pending_delta", jobId: "job-4", delta: 1 }))).toBe("job-4");
    expect(
      jobIdForOp(op({ type: "media_delete", jobId: "job-5", mediaId: "media-1", kind: "photo", storagePath: "jobs/job-5/photo.jpg" })),
    ).toBe("job-5");
  });

  it("reads job_id out of the row for ops shaped as a table upsert", () => {
    expect(jobIdForOp(op({ type: "job_details_upsert", row: { job_id: "job-6" } as never }))).toBe("job-6");
    expect(jobIdForOp(op({ type: "install_form_upsert", row: { job_id: "job-7" } as never }))).toBe("job-7");
    expect(jobIdForOp(op({ type: "signature_insert", row: { job_id: "job-8" } as never }))).toBe("job-8");
    expect(jobIdForOp(op({ type: "issue_insert", row: { job_id: "job-9" } as never }))).toBe("job-9");
  });

  it("returns null for a row-shaped op whose row has no job_id (should never happen, but shouldn't crash the ordering guard)", () => {
    expect(jobIdForOp(op({ type: "job_details_upsert", row: { job_id: null } as never }))).toBeNull();
  });
});
