"use client";

import imageCompression from "browser-image-compression";
import { db } from "./db";

/**
 * Compress client-side to ~1600px long edge, ~0.8 quality, before it enters
 * the outbox — storing full-resolution originals in IndexedDB is exactly
 * what triggers Safari's storage eviction (see PROMPT.md's media rules).
 */
export async function compressImage(file: File | Blob): Promise<Blob> {
  return imageCompression(file as File, {
    maxWidthOrHeight: 1600,
    initialQuality: 0.8,
    useWebWorker: false,
    fileType: "image/jpeg",
  });
}

export async function sha256Hex(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * GPS only at check-in, check-out and media capture — this is the media
 * capture instance of that non-negotiable rule. Never called on a timer or
 * in the background.
 */
export function getCurrentPosition(): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  });
}

export async function enqueuePhoto(params: {
  jobId: string;
  slot: string;
  file: File | Blob;
  capturedBy: string;
}): Promise<void> {
  const compressed = await compressImage(params.file);
  const [hash, position] = await Promise.all([sha256Hex(compressed), getCurrentPosition()]);
  const storagePath = `jobs/${params.jobId}/${params.slot}-${Date.now()}.jpg`;
  const now = new Date().toISOString();

  await db.transaction("rw", [db.mediaQueue, db.outbox], async () => {
    await db.mediaQueue.add({
      id: crypto.randomUUID(),
      jobId: params.jobId,
      kind: "photo",
      slot: params.slot,
      blob: compressed,
      mime: "image/jpeg",
      bytes: compressed.size,
      capturedAt: now,
      latitude: position?.coords.latitude,
      longitude: position?.coords.longitude,
      accuracyM: position?.coords.accuracy,
      sha256: hash,
      capturedBy: params.capturedBy,
      storagePath,
      status: "pending",
      attempts: 0,
    });
    await db.outbox.add({
      id: crypto.randomUUID(),
      type: "media_pending_delta",
      jobId: params.jobId,
      delta: 1,
      createdAt: now,
      attempts: 0,
    });
  });
}

export async function enqueueSignature(params: {
  jobId: string;
  blob: Blob;
  signerName: string;
  signerRole: string;
  capturedBy: string;
}): Promise<void> {
  const [hash, position] = await Promise.all([sha256Hex(params.blob), getCurrentPosition()]);
  const storagePath = `jobs/${params.jobId}/signature-${Date.now()}.png`;
  const now = new Date().toISOString();

  await db.transaction("rw", [db.mediaQueue, db.outbox], async () => {
    await db.mediaQueue.add({
      id: crypto.randomUUID(),
      jobId: params.jobId,
      kind: "signature",
      slot: "signature",
      blob: params.blob,
      mime: "image/png",
      bytes: params.blob.size,
      capturedAt: now,
      latitude: position?.coords.latitude,
      longitude: position?.coords.longitude,
      accuracyM: position?.coords.accuracy,
      sha256: hash,
      capturedBy: params.capturedBy,
      storagePath,
      status: "pending",
      attempts: 0,
      signerName: params.signerName,
      signerRole: params.signerRole,
    });
    await db.outbox.add({
      id: crypto.randomUUID(),
      type: "media_pending_delta",
      jobId: params.jobId,
      delta: 1,
      createdAt: now,
      attempts: 0,
    });
  });
}
