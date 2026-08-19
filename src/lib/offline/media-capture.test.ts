import { beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";
import { deleteMediaItem } from "./media-capture";

function makeItem(overrides: Partial<Parameters<typeof db.mediaQueue.add>[0]> = {}) {
  const blob = new Blob(["fake-image-bytes"], { type: "image/jpeg" });
  return {
    id: "media-1",
    jobId: "job-1",
    kind: "photo" as const,
    slot: "photo_before",
    blob,
    mime: "image/jpeg",
    bytes: blob.size,
    capturedAt: "2026-08-05T09:05:00Z",
    sha256: "deadbeef",
    capturedBy: "engineer-1",
    storagePath: "jobs/job-1/photo_before-1.jpg",
    status: "pending" as const,
    attempts: 0,
    ...overrides,
  };
}

describe("deleteMediaItem", () => {
  beforeEach(async () => {
    await db.mediaQueue.clear();
    await db.outbox.clear();
  });

  it("does nothing for an item that doesn't exist", async () => {
    await expect(deleteMediaItem("nonexistent")).resolves.toBeUndefined();
    expect(await db.outbox.count()).toBe(0);
  });

  it("removes a not-yet-uploaded item locally and cancels its pending delta", async () => {
    await db.mediaQueue.add(makeItem({ status: "pending" }));

    await deleteMediaItem("media-1");

    expect(await db.mediaQueue.get("media-1")).toBeUndefined();
    const ops = await db.outbox.toArray();
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ type: "media_pending_delta", jobId: "job-1", delta: -1 });
  });

  it("removes a failed item locally the same way as a pending one", async () => {
    await db.mediaQueue.add(makeItem({ status: "failed" }));

    await deleteMediaItem("media-1");

    const ops = await db.outbox.toArray();
    expect(ops[0]).toMatchObject({ type: "media_pending_delta", delta: -1 });
  });

  it("queues a server-side delete for an already-uploaded item, without a pending delta", async () => {
    await db.mediaQueue.add(makeItem({ status: "uploaded" }));

    await deleteMediaItem("media-1");

    expect(await db.mediaQueue.get("media-1")).toBeUndefined();
    const ops = await db.outbox.toArray();
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({
      type: "media_delete",
      jobId: "job-1",
      mediaId: "media-1",
      kind: "photo",
      storagePath: "jobs/job-1/photo_before-1.jpg",
    });
  });
});
