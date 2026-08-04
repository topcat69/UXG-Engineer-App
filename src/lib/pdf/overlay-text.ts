/**
 * The text burned onto each photo in the completion PDF — GPS and
 * timestamp, per spec. Burned into the *report page*, not the stored
 * original (Phase 3 deliberately stores unmodified capture bytes; the
 * report is where provenance gets presented as evidence). Pure formatting,
 * so it's testable without pdfkit or a database.
 */
export function formatGpsTimestampOverlay(
  latitude: number | null,
  longitude: number | null,
  capturedAtIso: string,
): string {
  const when = new Date(capturedAtIso).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "UTC",
  });
  const where = latitude != null && longitude != null ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` : "No GPS data";
  return `${where} · ${when} UTC`;
}
