/**
 * Converts a stored ISO timestamp into the value a `<input type="datetime-local">`
 * expects, using whatever timezone this code runs in — for a client
 * component, that's the browser's own local timezone, which is exactly what
 * a datetime-local input's value implicitly represents. Inverse of
 * localInputValueToIso below; the pair round-trips through the input with no
 * drift.
 */
export function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Converts a `<input type="datetime-local">` value ("2026-09-05T10:00", no
 * timezone by spec) into a proper UTC instant (ISO string, "Z"-suffixed) —
 * must be called client-side, where the browser's real local timezone
 * applies, since that's what a datetime-local value is implicitly in.
 * Passing the raw string across a Server Action boundary instead and
 * parsing it there uses the *server's* timezone rather than the office's,
 * which was a real bug: a server running in UTC turned a typed "10:00"
 * (BST, UTC+1) into 10:00 UTC — 11:00 BST once redisplayed, a full hour
 * later than what was entered. Returns "" for an empty/unparseable value.
 */
export function localInputValueToIso(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return "";
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const d = new Date(year, month - 1, day, hour, minute);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}
