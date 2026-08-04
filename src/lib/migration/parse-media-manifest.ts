import { optionalText, parseCsvRows, parseOptionalNumber, parseOptionalTimestamp, type ParseResult } from "./csv-helpers";

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "heic"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "webm"]);

export type MediaManifestRow = {
  jobNumber: string;
  slot: string;
  filename: string;
  media_type: "image" | "video";
  latitude?: number;
  longitude?: number;
  captured_at?: string;
  caption?: string;
  capturedByEmail?: string;
};

function mediaTypeFromFilename(filename: string): "image" | "video" | undefined {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!ext) return undefined;
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  return undefined;
}

/**
 * A real AppSheet "Photos"-style table export is a row per file with a
 * file-path/URL column plus capture metadata (GPS, timestamp, caption) —
 * this is that shape. `filename` is a path relative to the media source
 * directory (typically `<job folder>/<file>`, mirroring how the files
 * themselves are laid out once copied out of Drive). Bare files with no
 * manifest can't carry GPS/caption at all, so a manifest is the only way
 * "metadata preserved" can actually be true for migrated media.
 */
export function parseMediaManifestCsv(text: string): ParseResult<MediaManifestRow> {
  const { data, errors: parseErrors } = parseCsvRows(text);
  const errors = [...parseErrors];
  const rows: MediaManifestRow[] = [];

  data.forEach((raw, index) => {
    const rowNumber = index + 2;
    const jobNumber = raw.job_number?.trim();
    const slot = raw.slot?.trim();
    const filename = raw.filename?.trim();

    if (!jobNumber) {
      errors.push(`Row ${rowNumber}: missing required "job_number" column`);
      return;
    }
    if (!slot) {
      errors.push(`Row ${rowNumber}: missing required "slot" column`);
      return;
    }
    if (!filename) {
      errors.push(`Row ${rowNumber}: missing required "filename" column`);
      return;
    }

    const explicitType = raw.media_type?.trim().toLowerCase();
    const mediaType = explicitType === "image" || explicitType === "video" ? explicitType : mediaTypeFromFilename(filename);
    if (!mediaType) {
      errors.push(`Row ${rowNumber}: can't determine media_type for "${filename}" — set the media_type column explicitly`);
      return;
    }

    rows.push({
      jobNumber,
      slot,
      filename,
      media_type: mediaType,
      latitude: parseOptionalNumber(raw.latitude, "latitude", rowNumber, errors),
      longitude: parseOptionalNumber(raw.longitude, "longitude", rowNumber, errors),
      captured_at: parseOptionalTimestamp(raw.captured_at, "captured_at", rowNumber, errors),
      caption: optionalText(raw.caption),
      capturedByEmail: optionalText(raw.captured_by_email)?.toLowerCase(),
    });
  });

  return { rows, errors };
}
