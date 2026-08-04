import { google, type drive_v3 } from "googleapis";

/**
 * Deliberately no `import "server-only"` here, unlike calendar.ts — this
 * client is only ever imported by scripts/migrate-media.ts, run standalone
 * via tsx outside Next.js's bundler. "server-only" throws unconditionally
 * under a plain Node resolver (it relies on webpack's `react-server`
 * export condition to become a no-op), which would break the script for a
 * guard that has nothing to protect here — this module is never reachable
 * from a Next.js route or component.
 *
 * Same two auth modes as Calendar (see src/lib/google/calendar.ts's
 * getCalendarClient for the full rationale), reusing the same key and the
 * same GOOGLE_CALENDAR_IMPERSONATE_EMAIL rather than provisioning a
 * second one: domain-wide delegation when set, or the service account
 * acting directly on whatever Drive folder a human has explicitly shared
 * with its client_email when unset. Read-only scope — this script only
 * ever reads from Drive, never writes back to it. Returns null (not a
 * thrown error) only when GOOGLE_SERVICE_ACCOUNT_KEY itself is
 * unconfigured, matching every other optional integration in this app.
 */
export function getDriveClient(): drive_v3.Drive | null {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) return null;
  const impersonate = process.env.GOOGLE_CALENDAR_IMPERSONATE_EMAIL;

  const key = JSON.parse(keyJson) as { client_email: string; private_key: string };
  const auth = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    subject: impersonate || undefined,
  });
  return google.drive({ version: "v3", auth });
}
