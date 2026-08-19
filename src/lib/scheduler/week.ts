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

/**
 * Every calendar day (as "YYYY-MM-DD", matching the scheduler board's `day`
 * keys) a job's [scheduled_start, scheduled_end] span touches — a single
 * day for a same-day job, one entry per date for a multi-day one (e.g. a
 * 3-day on-site job runs `["2026-08-17", "2026-08-18", "2026-08-19"]`).
 * Sliced directly off the ISO timestamp strings rather than going through
 * a local-timezone Date, matching the exact scheme the scheduler board's
 * `day` values are already built with (week.ts's isoDate uses
 * toISOString().slice(0,10) too) — mixing local-time day boundaries into
 * one half of this comparison and UTC into the other would silently
 * misplace cards for anyone not in UTC.
 */
export function jobDayKeys(scheduledStart: string, scheduledEnd: string | null): string[] {
  const startKey = scheduledStart.slice(0, 10);
  const endKey = scheduledEnd?.slice(0, 10);
  if (!endKey || endKey <= startKey) return [startKey];

  const keys: string[] = [];
  let cursor = new Date(`${startKey}T00:00:00Z`);
  const last = new Date(`${endKey}T00:00:00Z`);
  while (cursor <= last) {
    keys.push(isoDate(cursor));
    cursor = addDays(cursor, 1);
  }
  return keys;
}

/**
 * Time-only range for a same-day job ("14:00 – 16:00", same as
 * formatTimeRange); a full date+time range for one spanning multiple
 * calendar days ("17 Aug 09:00 – 19 Aug 17:00") — a multi-day card needs
 * the dates too, since HH:MM alone can't tell "it's on site all week" from
 * "it's a quick 2-hour job".
 */
export function formatScheduleRange(start: string, end: string | null): string {
  if (!end || jobDayKeys(start, end).length <= 1) return formatTimeRange(start, end);
  const s = new Date(start);
  const e = new Date(end);
  const formatDay = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  return `${formatDay(s)} ${formatHm(s)} – ${formatDay(e)} ${formatHm(e)}`;
}
