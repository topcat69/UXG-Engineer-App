/**
 * "Day before" means the job's scheduled calendar day is tomorrow relative
 * to whenever the cron route runs — not "within the next 24 hours", which
 * would double-count across a single day depending on what time the cron
 * fires. Pure date-of-year comparison, no timezone library needed since
 * both inputs are already ISO instants.
 */
export function isScheduledForTomorrow(scheduledStartIso: string, nowIso: string): boolean {
  const scheduled = new Date(scheduledStartIso);
  const tomorrow = new Date(nowIso);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return (
    scheduled.getUTCFullYear() === tomorrow.getUTCFullYear() &&
    scheduled.getUTCMonth() === tomorrow.getUTCMonth() &&
    scheduled.getUTCDate() === tomorrow.getUTCDate()
  );
}
