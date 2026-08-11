"use client";

import imageCompression from "browser-image-compression";
import { db } from "./db";
import { extensionForMime, mediaKindForFile, MAX_VIDEO_BYTES } from "./media-kind";

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

export type EnqueueMediaResult = { ok: true } | { ok: false; error: string };

/**
 * Handles both photo and video capture for a slot. Photos are compressed
 * client-side (see compressImage); there's no equivalent for video, so a
 * video is queued at its original size but rejected upfront past
 * MAX_VIDEO_BYTES rather than risking IndexedDB storage eviction (see
 * media-kind.ts) or an upload that's never going to succeed over a site's
 * wifi/cellular connection.
 */
export async function enqueueMedia(params: {
  jobId: string;
  slot: string;
  file: File | Blob;
  capturedBy: string;
}): Promise<EnqueueMediaResult> {
  const kind = mediaKindForFile(params.file);

  if (kind === "video" && params.file.size > MAX_VIDEO_BYTES) {
    const maxMb = Math.round(MAX_VIDEO_BYTES / (1024 * 1024));
    const gotMb = Math.round(params.file.size / (1024 * 1024));
    return { ok: false, error: `Video is too large (${gotMb}MB, max ${maxMb}MB) — please record a shorter clip.` };
  }

  const blob = kind === "photo" ? await compressImage(params.file) : params.file;
  const mime = kind === "photo" ? "image/jpeg" : params.file.type || "video/mp4";
  const extension = kind === "photo" ? "jpg" : extensionForMime(mime);
  const [hash, position] = await Promise.all([sha256Hex(blob), getCurrentPosition()]);
  const storagePath = `jobs/${params.jobId}/${params.slot}-${Date.now()}.${extension}`;
  const now = new Date().toISOString();

  await db.transaction("rw", [db.mediaQueue, db.outbox], async () => {
    await db.mediaQueue.add({
      id: crypto.randomUUID(),
      jobId: params.jobId,
      kind,
      slot: params.slot,
      blob,
      mime,
      bytes: blob.size,
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

  return { ok: true };
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
