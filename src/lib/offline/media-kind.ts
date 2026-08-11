// Pulled out as pure/testable — everything else in enqueueMedia (media-capture.ts)
// needs Dexie, geolocation, or the network, so this is the one part of that
// path that can be unit tested directly.

/** Compressed photos are consistently small (~a few hundred KB, see
 * compressImage's 1600px/0.8-quality target); there's no equivalent
 * client-side compression available for video, so an engineer's raw phone
 * recording could easily be hundreds of MB. That's exactly the failure mode
 * this app's storage-eviction rules exist to avoid (see PROMPT.md), so
 * video gets a hard cap instead of a compression step. */
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export function mediaKindForFile(file: Blob): "photo" | "video" {
  return file.type.startsWith("video/") ? "video" : "photo";
}

export function extensionForMime(mime: string): string {
  if (mime === "video/quicktime") return "mov";
  const subtype = mime.split("/")[1];
  return subtype || "mp4";
}
