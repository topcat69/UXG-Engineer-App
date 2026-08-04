/**
 * Shared, pure config builder so both the server and client instrumentation
 * entry points init Sentry identically. Returns null when unconfigured —
 * Sentry is a no-op in this sandbox (no real DSN available), same pattern
 * as Calendar/Resend in Phase 4: real integration code, gated behind an
 * env var, that degrades to nothing rather than breaking the app.
 */
export function sentryOptions(dsn: string | undefined): { dsn: string; tracesSampleRate: number } | null {
  if (!dsn) return null;
  return {
    dsn,
    // Low, fixed sample rate rather than 100% — this app has ~8 users, so
    // even a small fraction of traced requests is plenty of signal without
    // meaningfully adding to Sentry event volume/cost.
    tracesSampleRate: 0.1,
  };
}
