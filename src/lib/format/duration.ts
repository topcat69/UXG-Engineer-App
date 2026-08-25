/**
 * "1h 23m" from a whole number of minutes — the shared formatting half of
 * formatDurationBetween below, split out so worked-duration.ts's
 * computeWorkedMinutes (which sums several intervals rather than
 * subtracting two timestamps) can reuse the exact same "Xh Ym" rendering
 * instead of a second, potentially-drifting copy of it. Returns null for
 * anything that isn't a real, non-negative duration, same convention as
 * formatDurationBetween.
 */
export function formatDurationMinutes(totalMinutes: number | null): string | null {
  if (totalMinutes === null || !Number.isFinite(totalMinutes) || totalMinutes < 0) return null;
  const rounded = Math.round(totalMinutes);
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

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

  return formatDurationMinutes((endMs - startMs) / 60_000);
}
