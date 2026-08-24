/**
 * "1h 23m" between two ISO timestamps — used alongside the raw timestamps
 * (office job detail page's status timeline, the completion PDF) so hours
 * spent travelling/on site can be read directly for billing checks rather
 * than mentally subtracted from two clock times. Returns null whenever a
 * duration can't be shown at all (an event hasn't happened yet, or the
 * timestamps are somehow out of order) rather than a misleading "0m".
 */
export function formatDurationBetween(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
): string | null {
  if (!startIso || !endIso) return null;
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return null;

  const totalMinutes = Math.round((endMs - startMs) / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}
