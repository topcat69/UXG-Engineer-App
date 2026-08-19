"use client";

import imageCompression from "browser-image-compression";
import { db } from "./db";
import { extensionForMime, mediaKindForFile, MAX_VIDEO_BYTES } from "./media-kind";
import { geocodePostcode } from "@/lib/geo/postcode";
import { generateId } from "./id";
import { bytesToHex, sha256Bytes } from "./sha256";

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

/**
 * crypto.subtle is spec-gated to secure contexts (HTTPS/localhost) just
 * like crypto.randomUUID (see id.ts) — undefined on plain HTTP, which
 * would otherwise throw "Cannot read properties of undefined (reading
 * 'digest')" on every photo/signature capture. Falls back to the pure-JS
 * implementation (sha256.ts) rather than skipping the hash entirely.
 */
export async function sha256Hex(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    return bytesToHex(new Uint8Array(hashBuffer));
  }
  return bytesToHex(sha256Bytes(new Uint8Array(buffer)));
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

export type ResolvedLocation = { latitude: number; longitude: number };
export type SiteForLocationFallback = { latitude?: number | null; longitude?: number | null; postcode?: string | null };

/**
 * Live GPS, falling back to the site's known location, then to geocoding
 * its postcode — per spec: "geo location needs to be done on either
 * geolocation or postcode." A live fix is always preferred (more accurate,
 * and reflects the engineer's actual position); the fallbacks exist so
 * Start Travelling/Check In/Submit never hard-block just because the
 * browser refused the Geolocation API outright — most commonly because the
 * app isn't served over HTTPS yet, which the device's own location
 * permission has no bearing on (see DECISIONS.md).
 */
/** The fallback half on its own — used by handleCheckIn, which needs to
 * know separately whether a fix came from live GPS (only that case feeds
 * the geofence-variance check, which is meaningless against a fallback
 * that's derived from the site's own coordinates in the first place). */
export async function siteLocationFallback(site: SiteForLocationFallback | undefined): Promise<ResolvedLocation | null> {
  if (site?.latitude != null && site?.longitude != null) {
    return { latitude: site.latitude, longitude: site.longitude };
  }
  if (site?.postcode) return geocodePostcode(site.postcode);
  return null;
}

export async function resolveJobLocation(site: SiteForLocationFallback | undefined): Promise<ResolvedLocation | null> {
  const position = await getCurrentPosition();
  if (position) return { latitude: position.coords.latitude, longitude: position.coords.longitude };
  return siteLocationFallback(site);
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
      id: generateId(),
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
      id: generateId(),
      type: "media_pending_delta",
      jobId: params.jobId,
      delta: 1,
      createdAt: now,
      attempts: 0,
    });
  });

  return { ok: true };
}

/**
 * Removes a captured photo/video before submission, per the field app's
 * "let me delete a photo I got wrong" request. drainMediaQueue runs on its
 * own independent retry loop and can upload an item before the engineer
 * ever taps Submit, so a delete has to account for both cases: an item
 * that's still local-only just needs its mediaQueue row (and the +1
 * media_pending_delta queued at capture time) undone; one that already
 * reached Storage/media_assets needs a media_delete outbox op so the next
 * drain removes it server-side too — media_pending was already
 * decremented when it uploaded, so no delta is queued for that case.
 */
export async function deleteMediaItem(itemId: string): Promise<void> {
  const item = await db.mediaQueue.get(itemId);
  if (!item) return;

  await db.transaction("rw", [db.mediaQueue, db.outbox], async () => {
    await db.mediaQueue.delete(itemId);
    if (item.status === "uploaded") {
      await db.outbox.add({
        id: generateId(),
        type: "media_delete",
        jobId: item.jobId,
        mediaId: item.id,
        kind: item.kind,
        storagePath: item.storagePath,
        createdAt: new Date().toISOString(),
        attempts: 0,
      });
    } else {
      await db.outbox.add({
        id: generateId(),
        type: "media_pending_delta",
        jobId: item.jobId,
        delta: -1,
        createdAt: new Date().toISOString(),
        attempts: 0,
      });
    }
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
      id: generateId(),
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
      id: generateId(),
      type: "media_pending_delta",
      jobId: params.jobId,
      delta: 1,
      createdAt: now,
      attempts: 0,
    });
  });
}
