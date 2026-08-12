// Pure, no "server-only" import (unlike job-archive.ts itself) — the same
// split as overlay-text.ts vs completion-report.ts, so this is directly
// unit-testable in vitest's jsdom environment.

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

export function extensionFor(mime: string | null, mediaType: string): string {
  if (mime?.includes("/")) return mime.split("/")[1];
  return mediaType === "video" ? "mp4" : "jpg";
}
