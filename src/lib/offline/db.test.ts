import { beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";

describe("offline db", () => {
  beforeEach(async () => {
    await db.jobs.clear();
    await db.outbox.clear();
    await db.mediaQueue.clear();
  });

  it("stores and retrieves a job", async () => {
    await db.jobs.put({
      id: "job-1",
      job_number: "UXG-2026-0001",
      project_id: null,
      site_id: "site-1",
      job_type: "install",
      status: "dispatched",
      priority: "P3",
      assigned_to: "engineer-1",
      scheduled_start: "2026-08-05T09:00:00Z",
      scheduled_end: "2026-08-05T11:00:00Z",
      actual_start: null,
      actual_end: null,
      actual_travel_start: null,
      check_in_lat: null,
      check_in_lng: null,
      travel_start_lat: null,
      travel_start_lng: null,
      geofence_variance_m: null,
      description: null,
      parent_job_id: null,
      source_issue_id: null,
      qa_status: "pending",
      qa_notes: null,
      calendar_event_id: null,
      email_thread_id: null,
      media_pending: 0,
      completion_pdf_url: null,
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-01T00:00:00Z",
    });

    const job = await db.jobs.get("job-1");
    expect(job?.job_number).toBe("UXG-2026-0001");

    const byStatus = await db.jobs.where("status").equals("dispatched").toArray();
    expect(byStatus).toHaveLength(1);
  });

  it("queues and drains outbox operations in insertion order", async () => {
    await db.outbox.add({
      id: "op-1",
      type: "job_patch",
      jobId: "job-1",
      patch: { status: "on_site" },
      createdAt: "2026-08-05T09:00:00Z",
      attempts: 0,
    });
    await db.outbox.add({
      id: "op-2",
      type: "status_event",
      jobId: "job-1",
      fromStatus: "dispatched",
      toStatus: "on_site",
      occurredAt: "2026-08-05T09:00:01Z",
      createdAt: "2026-08-05T09:00:01Z",
      attempts: 0,
    });

    const ops = await db.outbox.orderBy("createdAt").toArray();
    expect(ops.map((o) => o.id)).toEqual(["op-1", "op-2"]);
  });

  it("tracks media queue upload status", async () => {
    const blob = new Blob(["fake-image-bytes"], { type: "image/jpeg" });
    await db.mediaQueue.add({
      id: "media-1",
      jobId: "job-1",
      kind: "photo",
      slot: "photo_before",
      blob,
      mime: "image/jpeg",
      bytes: blob.size,
      capturedAt: "2026-08-05T09:05:00Z",
      sha256: "deadbeef",
      capturedBy: "engineer-1",
      storagePath: "jobs/job-1/photo_before.jpg",
      status: "pending",
      attempts: 0,
    });

    const pending = await db.mediaQueue.where("status").equals("pending").toArray();
    expect(pending).toHaveLength(1);
    expect(pending[0].bytes).toBe(blob.size);
  });
});
