/**
 * Turns a caught `unknown` into a readable string for logging/display.
 * `String(error)` on a plain object (e.g. a Google API error response
 * that isn't a real `Error` instance) gives back "[object Object]" —
 * useless for debugging, and exactly what every integration_failures /
 * cron_heartbeats row showed before this existed. Falls through to the
 * object's own `message` property when it has a string one (the shape
 * most non-Error API error payloads actually use), then JSON.stringify
 * as a last resort so at least the object's fields are visible.
 */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
