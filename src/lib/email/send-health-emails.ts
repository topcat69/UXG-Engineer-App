import "server-only";
import { sendStandaloneEmail, type SendResult } from "./resend";
import { buildHealthAlertEmail, type HealthAlertItem } from "./templates";

/**
 * Watchdog's alert — fans out to every active superadmin (not manager/
 * warehouse/finance, unlike the Damaged Equipment alert: a fault at
 * this level is an infrastructure concern, not a job-workflow one).
 * Not job-scoped, so it's a standalone send rather than threaded.
 */
export async function sendHealthAlertEmail(to: string, items: HealthAlertItem[]): Promise<SendResult> {
  const content = buildHealthAlertEmail({ items });
  return sendStandaloneEmail(to, content);
}
