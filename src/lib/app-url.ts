/**
 * The app's own public origin — used for deep links embedded in calendar
 * event descriptions and emails, and for building share-link URLs. Falls
 * back to localhost for local dev; every real deployment must set
 * NEXT_PUBLIC_APP_URL explicitly rather than guess it from request headers,
 * since this value ends up in places (calendar invites, sent email) that
 * outlive any single request.
 */
export function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}
