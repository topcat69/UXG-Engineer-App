import "server-only";

/**
 * Every server-to-server route in this app (the status-submitted DB
 * webhook, the day-before/weekly-summary cron routes) is authenticated by
 * the same shared secret rather than Supabase auth, since none of these
 * callers — Postgres, an external scheduler — has a browser session.
 */
export function verifyWebhookSecret(request: Request): boolean {
  const provided = request.headers.get("X-Webhook-Secret");
  const expected = process.env.WEBHOOK_SHARED_SECRET;
  return !!expected && provided === expected;
}
