const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight Monday of the week containing `date`, in the local timezone. */
export function mondayOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sunday .. 6 = Saturday
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatHm(date: Date): string {
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** "14:00 – 16:00" for the scheduler board's job cards — local time, 24h. Falls back to a single time when there's no end (duration unknown). */
export function formatTimeRange(start: string, end: string | null): string {
  const startLabel = formatHm(new Date(start));
  if (!end) return startLabel;
  return `${startLabel} – ${formatHm(new Date(end))}`;
}
